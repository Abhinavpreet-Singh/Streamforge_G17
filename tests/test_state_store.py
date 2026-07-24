import pytest

from src.state_store.rocksdb_store import RocksDBStateStore, TruckState


@pytest.fixture
def store_path(tmp_path):
    return tmp_path / "state"


def test_missing_truck_returns_empty_state(store_path):
    with RocksDBStateStore(store_path) as store:
        state = store.get(1)
        assert state.count == 0
        assert state.average == 0.0


def test_update_accumulates_running_average(store_path):
    with RocksDBStateStore(store_path) as store:
        store.update(1, 30.0)
        store.update(1, 40.0)
        state = store.get(1)
        assert state.count == 2
        assert state.average == 35.0


def test_state_survives_reopen(store_path):
    with RocksDBStateStore(store_path) as store:
        store.update(7, 36.0)
        store.update(7, 38.0)

    # Simulates a process restart that still has its local disk.
    with RocksDBStateStore(store_path) as reopened:
        state = reopened.get(7)
        assert state.count == 2
        assert state.average == 37.0


def test_writes_are_mirrored_to_changelog(store_path):
    published: list[tuple[str, dict]] = []

    with RocksDBStateStore(store_path, changelog_publisher=lambda k, v: published.append((k, v))):
        pass

    with RocksDBStateStore(
        store_path, changelog_publisher=lambda k, v: published.append((k, v))
    ) as store:
        store.update(3, 20.0)
        store.update(3, 30.0)

    assert [key for key, _ in published] == ["truck:3", "truck:3"]
    assert published[-1][1] == {"sum": 50.0, "count": 2}


def test_recovery_from_changelog_after_disk_loss(tmp_path):
    """The Final Review scenario: worker dies, its local state is gone, a
    replacement rebuilds from the changelog with no readings lost."""
    changelog: list[tuple[str, dict]] = []
    original_path = tmp_path / "worker-4"

    with RocksDBStateStore(
        original_path, changelog_publisher=lambda k, v: changelog.append((k, v))
    ) as dying_worker:
        dying_worker.update(1, 30.0)
        dying_worker.update(1, 36.0)
        dying_worker.update(2, 41.0)
        expected_truck_1 = dying_worker.get(1)
        expected_truck_2 = dying_worker.get(2)

    # Replacement worker starts with an empty disk.
    replacement_path = tmp_path / "worker-5"
    with RocksDBStateStore(replacement_path) as replacement:
        restored = replacement.restore_from_changelog(iter(changelog))

        assert restored == 2
        assert replacement.get(1) == expected_truck_1
        assert replacement.get(2) == expected_truck_2
        assert replacement.get(1).average == 33.0


def test_changelog_replay_is_idempotent(tmp_path):
    """Replaying the same changelog twice must not double-count — this is
    what makes at-least-once changelog delivery safe."""
    changelog = [
        ("truck:1", {"sum": 30.0, "count": 1}),
        ("truck:1", {"sum": 66.0, "count": 2}),
    ]

    with RocksDBStateStore(tmp_path / "replay") as store:
        store.restore_from_changelog(iter(changelog))
        first = store.get(1)
        store.restore_from_changelog(iter(changelog))
        assert store.get(1) == first
        assert store.get(1).count == 2


def test_all_states_round_trips_truck_ids(store_path):
    with RocksDBStateStore(store_path) as store:
        store.update(11, 25.0)
        store.update(22, 35.0)
        states = store.all_states()

    assert set(states) == {11, 22}
    assert states[11].average == 25.0


def test_truck_state_average_of_empty_is_zero():
    assert TruckState().average == 0.0

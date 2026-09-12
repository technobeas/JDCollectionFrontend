import { useEffect, useState } from "react";
import api from "../../lib/api";
import { cachedGet, cacheClearPrefix, cacheRemove } from "../../lib/cache";
import Pagination from "../../components/Pagination";
import RefreshButton from "../../components/RefreshButton";
import ConfirmModal from "../../components/ConfirmModal";

const PAGE_SIZE = 20;

export default function Notifications() {
  const [n, setN] = useState([]),
    [f, setF] = useState({ title: "", message: "", url: "/" }),
    [busy, setBusy] = useState(false);
  const paths = [
    ["/", "Home"],
    ["/categories", "Categories"],
    ["/offers", "Today's Offers"],
    ["/most-demanded", "Most Demanded"],
    ["/shop", "Shop Details"],
  ];
  const [page, setPage] = useState(1),
    [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 }),
    [refreshing, setRefreshing] = useState(false);
  const cacheKey = `notifications:admin:${page}`;
  const [modal, setModal] = useState(null);

  function showMessage(title, message) {
    setModal({
      title,
      message,
      confirmText: "OK",
      danger: false,
      showCancel: false,
    });
  }

  async function load(force = false) {
    try {
      const r = await cachedGet(
        api,
        `/notifications?page=${page}&limit=${PAGE_SIZE}`,
        { key: cacheKey, forceRefresh: force },
      );
      setN(r.data?.items || r.data || []);
      setPagination(
        r.data?.pagination || { page, pages: 1, total: r.data?.length || 0 },
      );
    } catch (e) {
      showMessage(
        "Could not load notifications",
        e.response?.data?.message || "Please try again.",
      );
    }
  }
  useEffect(() => {
    load(false);
  }, [page]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/notifications", f);
      await api.post(`/notifications/${r.data._id}/send`);
      setF({ title: "", message: "", url: "/" });
      await cacheClearPrefix("notifications:");
      await cacheClearPrefix("dashboard:");
      await load(true);
    } catch (e) {
      showMessage(
        "Could not send notification",
        e.response?.data?.message || "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setRefreshing(true);
    try {
      await cacheRemove(cacheKey);
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Send updates to customers who enabled browser notifications.
          </p>
        </div>
        <RefreshButton onClick={refresh} busy={refreshing} />
      </div>
      <form onSubmit={create} className="card mt-6 max-w-2xl p-4 sm:p-6">
        <label className="block text-sm font-bold">
          Title
          <input
            required
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
          />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Message
          <textarea
            required
            value={f.message}
            onChange={(e) => setF({ ...f, message: e.target.value })}
            rows="4"
            className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
          />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Destination Path
          <select
            value={paths.some(([p]) => p === f.url) ? f.url : "__custom"}
            onChange={(e) =>
              setF({
                ...f,
                url: e.target.value === "__custom" ? "" : e.target.value,
              })
            }
            className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
          >
            {paths.map(([path, label]) => (
              <option key={path} value={path}>
                {label} — {path}
              </option>
            ))}
            <option value="__custom">Custom path…</option>
          </select>
          {!paths.some(([p]) => p === f.url) && (
            <input
              value={f.url}
              onChange={(e) => setF({ ...f, url: e.target.value })}
              placeholder="/products/example-slug"
              className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
            />
          )}
        </label>
        <button disabled={busy} className="btn-primary mt-5 w-full sm:w-auto">
          {busy ? "Sending..." : "Create & Send Now"}
        </button>
      </form>
      {n.length === 0 ? (
        <div className="mt-6 card p-8 text-center text-slate-400">
          No notifications yet.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:hidden">
            {n.map((x) => (
              <div className="card p-4" key={x._id}>
                <div className="font-black">{x.title}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {new Date(x.createdAt).toLocaleString()}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-slate-50 p-2">
                    <b>{x.status}</b>
                    <div>Status</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <b>{x.successCount || 0}</b>
                    <div>Success</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <b>{x.failureCount || 0}</b>
                    <div>Failed</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card mt-6 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Title",
                    "Status",
                    "Recipients",
                    "Success",
                    "Failure",
                    "Date",
                  ].map((x) => (
                    <th className="px-4 py-3" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {n.map((x) => (
                  <tr key={x._id}>
                    <td className="px-4 py-3 font-bold">{x.title}</td>
                    <td className="px-4 py-3">{x.status}</td>
                    <td className="px-4 py-3">{x.recipientCount || 0}</td>
                    <td className="px-4 py-3">{x.successCount || 0}</td>
                    <td className="px-4 py-3">{x.failureCount || 0}</td>
                    <td className="px-4 py-3">
                      {new Date(x.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={pagination.page || page}
            pages={pagination.pages}
            total={pagination.total}
            onChange={setPage}
          />
        </>
      )}

      <ConfirmModal
        open={Boolean(modal)}
        title={modal?.title}
        message={modal?.message}
        confirmText={modal?.confirmText || "OK"}
        danger={modal?.danger ?? false}
        showCancel={modal?.showCancel ?? false}
        onConfirm={() => setModal(null)}
        onClose={() => setModal(null)}
      />
    </div>
  );
}

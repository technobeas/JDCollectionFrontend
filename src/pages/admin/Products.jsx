import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Trash2, Edit3 } from "lucide-react";
import api from "../../lib/api";
import { cachedGet, cacheClearPrefix, cacheRemove } from "../../lib/cache";
import { money } from "../../lib/utils";
import ConfirmModal from "../../components/ConfirmModal";
import Pagination from "../../components/Pagination";
import RefreshButton from "../../components/RefreshButton";

const PAGE_SIZE = 20;

export default function Products() {
  const [products, setProducts] = useState([]),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [deleteTarget, setDeleteTarget] = useState(null),
    [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null);

  const cacheKey = `products:admin:${page}:${q.trim().toLowerCase()}`;

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
    setLoading(true);
    try {
      const url = `/products/admin/list?page=${page}&limit=${PAGE_SIZE}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
      const r = await cachedGet(api, url, {
        key: cacheKey,
        forceRefresh: force,
      });
      setProducts(r.data.items || []);
      setPagination(r.data.pagination || { page, pages: 1, total: 0 });
    } catch (e) {
      setProducts([]);
      showMessage(
        "Could not load products",
        e.response?.data?.message || "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(false), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, page]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  async function del() {
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteTarget._id}`);
      setDeleteTarget(null);
      await cacheClearPrefix("products:");
      await cacheClearPrefix("product:");
      await load(true);
    } catch (e) {
      showMessage(
        "Could not delete product",
        e.response?.data?.message || "Please try again.",
      );
    } finally {
      setDeleting(false);
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
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage prices, availability, photos and videos.
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton onClick={refresh} busy={refreshing} />
          <Link to="/admin/products/new" className="btn-primary">
            <Plus size={18} /> Add Product
          </Link>
        </div>
      </div>
      <div className="card mt-6 p-4">
        <div className="relative max-w-xl">
          <Search
            className="absolute left-3 top-3.5 text-slate-400"
            size={18}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, SKU or product code..."
            className="w-full rounded-2xl bg-slate-100 py-3 pl-10 pr-4"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400">
          Loading products...
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:hidden">
            {products.map((x) => (
              <div className="card p-4" key={x._id}>
                <div className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                    {x.images?.[0]?.secureUrl ? (
                      <img
                        src={x.images[0].secureUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-3xl">
                        🧸
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-black">{x.name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      SKU: {x.sku}
                      {x.productCode && <> · Code: {x.productCode}</>}
                      {" · "}
                      {x.category?.name} · Qty {x.stockQuantity ?? 1}
                    </div>
                    <div className="mt-2 font-black">
                      {money(x.sellingPrice)}{" "}
                      {x.discountedPrice != null && (
                        <span className="text-sm text-slate-400">
                          → {money(x.discountedPrice)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`mt-1 text-xs font-bold ${x.isAvailable ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {x.isAvailable ? "Available" : "Out of Stock"}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    className="btn-soft flex-1"
                    to={`/admin/products/${x._id}`}
                  >
                    <Edit3 size={16} /> Edit
                  </Link>
                  <button
                    className="btn-soft p-2 text-red-600"
                    onClick={() => setDeleteTarget(x)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="card mt-6 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1250px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Product",
                    "SKU",
                    "Product Code",
                    "Category",
                    "Qty",
                    "Purchase",
                    "Selling",
                    "Discount",
                    "Normal Profit",
                    "Discount Profit",
                    "Availability",
                    "Actions",
                  ].map((x) => (
                    <th className="px-4 py-3 font-bold" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((x) => (
                  <tr key={x._id}>
                    <td className="px-4 py-3 font-bold">{x.name}</td>
                    <td className="px-4 py-3">{x.sku}</td>
                    <td className="px-4 py-3 font-bold text-slate-600">
                      {x.productCode || "—"}
                    </td>
                    <td className="px-4 py-3">{x.category?.name}</td>
                    <td className="px-4 py-3 font-bold">
                      {x.stockQuantity ?? 1}
                    </td>
                    <td className="px-4 py-3">{money(x.purchasePrice)}</td>
                    <td className="px-4 py-3">{money(x.sellingPrice)}</td>
                    <td className="px-4 py-3">
                      {x.discountedPrice == null
                        ? "—"
                        : money(x.discountedPrice)}
                    </td>
                    <td className="px-4 py-3">{money(x.normalProfit)}</td>
                    <td className="px-4 py-3">
                      {x.discountedProfit == null
                        ? "—"
                        : money(x.discountedProfit)}
                    </td>
                    <td className="px-4 py-3">
                      {x.isAvailable ? "Available" : "Out of Stock"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          className="btn-soft p-2"
                          to={`/admin/products/${x._id}`}
                        >
                          <Edit3 size={16} />
                        </Link>
                        <button
                          className="btn-soft p-2 text-red-600"
                          onClick={() => setDeleteTarget(x)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
        open={Boolean(deleteTarget)}
        title="Delete product?"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.name}”? Its product media will also be removed from Cloudinary.`
            : ""
        }
        onConfirm={del}
        onClose={() => !deleting && setDeleteTarget(null)}
        busy={deleting}
      />

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

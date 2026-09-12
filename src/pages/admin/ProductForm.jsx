import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ImagePlus,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../lib/api";
import { cachedGet, cacheClearPrefix, cacheRemove } from "../../lib/cache";
import ConfirmModal from "../../components/ConfirmModal";
import RefreshButton from "../../components/RefreshButton";

function MediaPreview({ item, onRemove, onUp, onDown, canUp, canDown }) {
  const isVideo = item.type === "video";
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-black/5">
      <div className="aspect-square">
        {isVideo ? (
          <video
            src={item.preview}
            controls
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={item.preview}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="absolute left-2 top-2 flex gap-1.5">
        <span className="badge bg-white/90 shadow-sm">
          {isVideo ? "Video" : "Photo"}
        </span>
        {item.existing && (
          <span className="badge bg-white/90 shadow-sm">Saved</span>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-red-600 text-white shadow"
        title="Remove"
        aria-label="Remove media"
      >
        <X size={17} />
      </button>
      <div className="absolute bottom-2 left-2 right-2 flex justify-between gap-2">
        <button
          type="button"
          disabled={!canUp}
          onClick={onUp}
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/90 shadow disabled:opacity-30"
          title="Move up"
        >
          <ArrowUp size={17} />
        </button>
        <button
          type="button"
          disabled={!canDown}
          onClick={onDown}
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/90 shadow disabled:opacity-30"
          title="Move down"
        >
          <ArrowDown size={17} />
        </button>
      </div>
    </div>
  );
}

function skuBaseFromName(name) {
  return String(name || "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export default function ProductForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    productCode: "",
    category: "",
    description: "",
    specifications: {},
    stockQuantity: 1,
    colors: [],
    sizes: [],
    purchasePrice: 0,
    sellingPrice: 0,
    discountedPrice: "",
    isPriceVisible: true,
    isAvailable: true,
    isTodaysOffer: false,
    isMostDemanded: false,
  });
  const [media, setMedia] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [deleteModal, setDeleteModal] = useState(null);
  const [modal, setModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false),
    [refreshNonce, setRefreshNonce] = useState(0);
  const mediaRef = useRef([]);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  function showMessage(title, message) {
    setModal({
      title,
      message,
      confirmText: "OK",
      danger: false,
      showCancel: false,
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [cr, pr] = await Promise.all([
          cachedGet(api, "/categories?active=false&page=1&limit=100", {
            key: "categories:admin:form",
          }),
          id
            ? cachedGet(api, `/products/admin/${id}`, {
                key: `product:admin:${id}`,
              })
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCats(cr.data?.items || cr.data || []);
        if (pr) {
          const p = pr.data;
          setForm({
            ...p,
            category: p.category?._id || p.category,
            discountedPrice: p.discountedPrice ?? "",
          });
          setMedia([
            ...(p.images || []).map((m) => ({
              existing: true,
              type: "image",
              id: m.publicId,
              preview: m.secureUrl,
            })),
            ...(p.videos || []).map((m) => ({
              existing: true,
              type: "video",
              id: m.publicId,
              preview: m.secureUrl,
            })),
          ]);
        }
      } catch (e) {
        if (!cancelled)
          showMessage(
            "Could not load product",
            e.response?.data?.message || "Please try again.",
          );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, refreshNonce]);

  useEffect(
    () => () =>
      mediaRef.current.forEach(
        (m) =>
          !m.existing &&
          m.preview?.startsWith("blob:") &&
          URL.revokeObjectURL(m.preview),
      ),
    [],
  );

  function set(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v };

      // Generate SKU only while creating a new product.
      // Existing product SKU is never changed automatically.
      if (k === "name" && !id && !f.sku) {
        const base = skuBaseFromName(v);

        if (base) {
          next.sku = `${base}-001`;
        } else {
          next.sku = "";
        }
      }

      return next;
    });
  }

  function addFiles(e) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const added = selected.map((file) => ({
      existing: false,
      type: file.type.startsWith("video/") ? "video" : "image",
      file,
      preview: URL.createObjectURL(file),
      token: crypto.randomUUID(),
    }));
    setMedia((current) => [...current, ...added]);
    e.target.value = "";
  }

  function removeMedia(index) {
    const item = media[index];
    if (!item) return;
    if (!item.existing) {
      URL.revokeObjectURL(item.preview);
      setMedia((current) => current.filter((_, i) => i !== index));
      return;
    }
    setDeleteModal({ index, item });
  }

  function confirmRemoveExisting() {
    const index = deleteModal.index;
    setMedia((current) => current.filter((_, i) => i !== index));
    setDeleteModal(null);
  }

  function moveMedia(index, direction) {
    setMedia((current) => {
      const item = current[index];
      if (!item) return current;
      const sameTypeIndexes = current
        .map((m, i) => (m.type === item.type ? i : -1))
        .filter((i) => i >= 0);
      const position = sameTypeIndexes.indexOf(index);
      const targetPosition = position + direction;
      if (targetPosition < 0 || targetPosition >= sameTypeIndexes.length)
        return current;
      const target = sameTypeIndexes[targetPosition];
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const images = useMemo(
    () => media.filter((m) => m.type === "image"),
    [media],
  );
  const videos = useMemo(
    () => media.filter((m) => m.type === "video"),
    [media],
  );

  async function refreshFromServer() {
    setRefreshing(true);
    try {
      await cacheClearPrefix("categories:");
      if (id) await cacheRemove(`product:admin:${id}`);
      setRefreshNonce((x) => x + 1);
    } finally {
      // The loading effect clears this once the fresh server data arrives.
      // Keep the button responsive even if cache cleanup itself fails.
      if (!id) setRefreshing(false);
    }
  }

  function addOption(key) {
    setForm((f) => ({ ...f, [key]: [...(f[key] || []), ""] }));
  }
  function updateOption(key, index, value) {
    setForm((f) => ({
      ...f,
      [key]: (f[key] || []).map((x, i) => (i === index ? value : x)),
    }));
  }
  function removeOption(key, index) {
    setForm((f) => ({
      ...f,
      [key]: (f[key] || []).filter((_, i) => i !== index),
    }));
  }

  async function save(e) {
    e.preventDefault();
    if (
      form.discountedPrice !== "" &&
      Number(form.discountedPrice) >= Number(form.sellingPrice)
    ) {
      showMessage(
        "Invalid discounted price",
        "Discounted price must be lower than selling price.",
      );
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      const newItems = media.filter((m) => !m.existing);
      const tokenByItem = new Map(
        newItems.map((m, i) => [m.token, `new:${i}`]),
      );
      const data = {
        name: form.name,
        sku: form.sku,
        productCode: form.productCode?.trim().toUpperCase() || "",
        category: form.category,
        description: form.description || "",
        stockQuantity: Math.max(0, Math.floor(Number(form.stockQuantity) || 0)),
        colors: (form.colors || []).map((x) => x.trim()).filter(Boolean),
        sizes: (form.sizes || []).map((x) => x.trim()).filter(Boolean),
        specifications: form.specifications || {},
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        discountedPrice:
          form.discountedPrice === "" ? null : Number(form.discountedPrice),
        isPriceVisible: Boolean(form.isPriceVisible),
        isAvailable: Boolean(form.isAvailable),
        isTodaysOffer: Boolean(form.isTodaysOffer),
        isMostDemanded: Boolean(form.isMostDemanded),
        mediaOrder: {
          images: images.map((m) =>
            m.existing ? `existing:${m.id}` : tokenByItem.get(m.token),
          ),
          videos: videos.map((m) =>
            m.existing ? `existing:${m.id}` : tokenByItem.get(m.token),
          ),
        },
      };
      fd.append("data", JSON.stringify(data));
      newItems.forEach((m) => fd.append("media", m.file));
      await (id ? api.put(`/products/${id}`, fd) : api.post("/products", fd));
      await cacheClearPrefix("products:");
      await cacheClearPrefix("product:");
      await cacheClearPrefix("categories:");
      await cacheClearPrefix("dashboard:");
      if (id) await cacheClearPrefix(`product:admin:${id}`);
      nav("/admin/products");
    } catch (e) {
      showMessage(
        "Could not save product",
        e.response?.data?.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <div className="py-10 text-slate-500">Loading product...</div>;

  function MediaSection({ title, items }) {
    return (
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black">{title}</h2>
          <span className="text-xs font-semibold text-slate-400">
            {items.length} selected
          </span>
        </div>
        {items.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
              const index = media.indexOf(item);
              return (
                <MediaPreview
                  key={item.existing ? item.id : item.token}
                  item={item}
                  onRemove={() => removeMedia(index)}
                  onUp={() => moveMedia(index, -1)}
                  onDown={() => moveMedia(index, 1)}
                  canUp={
                    media
                      .filter((m) => m.type === item.type)
                      .findIndex((m) => m === item) > 0
                  }
                  canDown={
                    media
                      .filter((m) => m.type === item.type)
                      .findIndex((m) => m === item) <
                    media.filter((m) => m.type === item.type).length - 1
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-400">
            No {title.toLowerCase()} yet.
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">
            {id ? "Edit Product" : "Add Product"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage product details, photos, videos, and their order.
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton onClick={refreshFromServer} busy={refreshing} />
          <button
            type="button"
            className="btn-soft"
            onClick={() => nav("/admin/products")}
          >
            <ArrowLeft size={17} /> Back
          </button>
        </div>
      </div>
      <form onSubmit={save} className="card mt-6 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["name", "Product Name", "text"],
            ["sku", "SKU", "text"],
            ["productCode", "Product Code", "text"],
            ["stockQuantity", "Quantity / Stock", "number"],
            ["purchasePrice", "Purchase Price", "number"],
            ["sellingPrice", "Selling Price", "number"],
            ["discountedPrice", "Discounted Price", "number"],
          ].map(([k, l, t]) => (
            <label key={k} className="text-sm font-bold">
              {l}
              <input
                type={t}
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
                readOnly={k === "sku"}
                className={`mt-2 w-full rounded-2xl p-3 ${
                  k === "sku"
                    ? "cursor-not-allowed bg-slate-200 text-slate-600"
                    : "bg-slate-100"
                }`}
                required={k !== "discountedPrice"}
                min={t === "number" ? 0 : undefined}
                step={
                  k === "stockQuantity"
                    ? "1"
                    : t === "number"
                      ? "0.01"
                      : undefined
                }
              />
            </label>
          ))}
          <label className="text-sm font-bold">
            Category
            <select
              required
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
            >
              <option value="">Select category</option>
              {cats.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            [
              "colors",
              "Available Colors",
              "Add colors only when this product has color choices.",
            ],
            [
              "sizes",
              "Available Sizes",
              "Add sizes only when this product has size choices.",
            ],
          ].map(([key, title, hint]) => (
            <section key={key} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-black">{title}</h2>
                  <p className="text-xs text-slate-400">{hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addOption(key)}
                  className="btn-soft px-3 py-2 text-xs"
                >
                  + Add
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                {(form[key] || []).map((value, index) => (
                  <div className="flex gap-2" key={`${key}-${index}`}>
                    <input
                      value={value}
                      onChange={(e) => updateOption(key, index, e.target.value)}
                      placeholder={key === "colors" ? "e.g. Red" : "e.g. Small"}
                      className="min-w-0 flex-1 rounded-xl bg-white p-3 ring-1 ring-black/5"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(key, index)}
                      className="btn-soft p-3 text-red-600"
                      aria-label={`Remove ${key} option`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {!form[key]?.length && (
                  <p className="text-xs text-slate-400">
                    Leave empty to hide this section on the public product page.
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
        <label className="mt-4 block text-sm font-bold">
          Description
          <textarea
            rows="5"
            value={form.description || ""}
            onChange={(e) => set("description", e.target.value)}
            className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
          />
        </label>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["isPriceVisible", "Show Public Price"],
            ["isAvailable", "Available"],
            ["isTodaysOffer", "Today's Offer"],
            ["isMostDemanded", "Most Demanded"],
          ].map(([k, l]) => (
            <label
              key={k}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-bold"
            >
              <input
                type="checkbox"
                checked={Boolean(form[k])}
                onChange={(e) => set(k, e.target.checked)}
                className="h-5 w-5"
              />
              {l}
            </label>
          ))}
        </div>

        <section className="mt-7 rounded-3xl bg-slate-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Media</h2>
              <p className="mt-1 text-xs text-slate-500">
                Add more without overwriting existing media. Remove anything you
                do not want and use the arrows to reorder.
              </p>
            </div>
            <label className="btn-primary cursor-pointer">
              <ImagePlus size={17} /> Add photos / videos
              <input
                hidden
                multiple
                type="file"
                accept="image/*,video/*"
                onChange={addFiles}
              />
            </label>
          </div>
          <MediaSection title="Photos" items={images} />
          <MediaSection title="Videos" items={videos} />
        </section>
        <button disabled={saving} className="btn-primary mt-6 w-full sm:w-auto">
          {saving ? "Saving..." : id ? "Save Changes" : "Create Product"}
        </button>
      </form>
      <ConfirmModal
        open={Boolean(deleteModal)}
        title="Remove this saved media?"
        message="It will be removed from this product when you save. The original file will also be removed from Cloudinary."
        confirmText="Remove"
        onConfirm={confirmRemoveExisting}
        onClose={() => setDeleteModal(null)}
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

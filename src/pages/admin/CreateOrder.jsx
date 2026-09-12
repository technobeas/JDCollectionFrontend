import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import api from "../../lib/api";
import { cacheClearPrefix } from "../../lib/cache";
import { money } from "../../lib/utils";
import ConfirmModal from "../../components/ConfirmModal";

const PAGE_SIZE = 30;

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export default function CreateOrder() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);
  const [finalTotal, setFinalTotal] = useState("");
  const [finalTotalEdited, setFinalTotalEdited] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [alertModal, setAlertModal] = useState({
    open: false,
    title: "",
    message: "",
  });

  function showAlert(message, title = "Please check") {
    setAlertModal({ open: true, title, message });
  }

  function closeAlert() {
    setAlertModal({ open: false, title: "", message: "" });
  }

  async function searchProducts(value = query) {
    setSearching(true);
    try {
      const q = String(value || "").trim();
      const url = `/products/admin/list?page=1&limit=${PAGE_SIZE}${q ? `&q=${encodeURIComponent(q)}` : ""}&available=true`;
      const r = await api.get(url);
      setResults(r.data?.items || []);
    } catch (e) {
      showAlert(
        e.response?.data?.message || "Could not search products.",
        "Search failed",
      );
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(
      () => searchProducts(query),
      query.trim() ? 300 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  function chooseProduct(product) {
    setSelectedProduct(product);
    setColor("");
    setSize("");
    setQuantity(1);
  }

  const productSellingPrice = selectedProduct
    ? Number(selectedProduct.sellingPrice ?? 0)
    : 0;
  const productDiscountedPrice =
    selectedProduct?.discountedPrice != null
      ? Number(selectedProduct.discountedPrice)
      : productSellingPrice;

  function changeAddQuantity(next) {
    const stock = Math.max(1, Number(selectedProduct?.stockQuantity ?? 1));
    const value = Math.floor(Number(next));
    setQuantity(
      Number.isFinite(value) ? Math.max(1, Math.min(stock, value)) : 1,
    );
  }

  function addToCart() {
    if (!selectedProduct) return;
    if (selectedProduct.colors?.length && !color) {
      showAlert("Select a color before adding this product.", "Color required");
      return;
    }
    if (selectedProduct.sizes?.length && !size) {
      showAlert("Select a size before adding this product.", "Size required");
      return;
    }

    const qty = Math.floor(Number(quantity));
    const stock = Number(selectedProduct.stockQuantity ?? 0);
    if (!Number.isInteger(qty) || qty < 1 || qty > stock) {
      showAlert(`Quantity must be between 1 and ${stock}.`, "Invalid quantity");
      return;
    }

    const key = `${selectedProduct._id}|${color}|${size}`;
    setCart((current) => {
      const existing = current.findIndex((x) => x.key === key);
      if (existing < 0) {
        return [
          ...current,
          {
            key,
            product: selectedProduct._id,
            name: selectedProduct.name,
            sku: selectedProduct.sku,
            productCode: selectedProduct.productCode || "",
            color,
            size,
            quantity: qty,
            stockQuantity: stock,
            sellingPrice: productSellingPrice,
            discountedPrice: productDiscountedPrice,
          },
        ];
      }
      return current.map((x, i) =>
        i === existing
          ? { ...x, quantity: Math.min(x.quantity + qty, x.stockQuantity) }
          : x,
      );
    });
    setSelectedProduct(null);
    setColor("");
    setSize("");
    setQuantity(1);
  }

  function updateCartQty(key, next) {
    setCart((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              quantity: Math.max(
                1,
                Math.min(item.stockQuantity, Math.floor(Number(next) || 1)),
              ),
            }
          : item,
      ),
    );
  }

  const subtotal = useMemo(
    () =>
      roundMoney(
        cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0),
      ),
    [cart],
  );

  // Discount already built into the product price: selling price -> discounted price.
  const productDiscount = useMemo(
    () =>
      roundMoney(
        cart.reduce((sum, item) => {
          return (
            sum +
            Math.max(0, item.sellingPrice - item.discountedPrice) *
              item.quantity
          );
        }, 0),
      ),
    [cart],
  );

  const discountedSubtotal = roundMoney(subtotal - productDiscount);
  const parsedFinal = Number(finalTotal);
  const effectiveFinal =
    finalTotal === ""
      ? discountedSubtotal
      : Number.isFinite(parsedFinal)
        ? roundMoney(parsedFinal)
        : 0;

  // Extra discount is anything reduced after the product's own discounted price.
  const additionalDiscount = roundMoney(
    Math.max(0, discountedSubtotal - effectiveFinal),
  );
  const totalDiscount = roundMoney(productDiscount + additionalDiscount);

  useEffect(() => {
    if (!cart.length) {
      setFinalTotal("");
      setFinalTotalEdited(false);
      return;
    }

    // Keep the automatic total synced with quantity/cart changes until the
    // admin intentionally edits it. If an edited amount becomes too high
    // after removing items, safely clamp it to the new discounted subtotal.
    setFinalTotal((current) => {
      if (!finalTotalEdited) return String(discountedSubtotal);
      const value = Number(current);
      return Number.isFinite(value)
        ? String(roundMoney(Math.min(Math.max(0, value), discountedSubtotal)))
        : String(discountedSubtotal);
    });
  }, [cart.length, discountedSubtotal, finalTotalEdited]);

  function changeFinalTotal(value) {
    setFinalTotalEdited(true);
    setFinalTotal(value);
  }

  async function createOrder(e) {
    e.preventDefault();
    if (!cart.length)
      return showAlert(
        "Add at least one product to the cart.",
        "Cart is empty",
      );

    const total = roundMoney(Number(finalTotal));
    if (!Number.isFinite(total) || total < 0 || total > discountedSubtotal) {
      return showAlert(
        `Final total must be between ₹0 and ${money(discountedSubtotal)}.`,
        "Invalid final total",
      );
    }

    setSaving(true);
    setSuccess(null);
    try {
      const r = await api.post("/orders", {
        customerName,
        customerPhone,
        paymentMethod,
        notes,
        finalTotal: total,
        items: cart.map((item) => ({
          product: item.product,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
        })),
      });
      await Promise.all([
        cacheClearPrefix("products:"),
        cacheClearPrefix("product:"),
        cacheClearPrefix("dashboard:"),
      ]);
      setSuccess(r.data);
      setCart([]);
      setSelectedProduct(null);
      setQuery("");
      setResults([]);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMethod("Cash");
      setNotes("");
      setFinalTotal("");
      setFinalTotalEdited(false);
      await searchProducts("");
    } catch (e) {
      showAlert(
        e.response?.data?.message || "Could not create order.",
        "Order could not be created",
      );
      await searchProducts(query);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <h1 className="text-3xl font-black">Create Order</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search products, choose variants and quantity, then set the exact sale
          amount. Product discounts and any extra discount are calculated
          automatically.
        </p>
      </div>

      {success && (
        <div className="mt-5 flex items-start gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="mt-0.5 shrink-0" />
          <div>
            <div className="font-black">
              Order {success.orderNumber} created successfully.
            </div>
            <div className="mt-1 text-sm">
              Revenue: <b>{money(success.finalTotal)}</b> · Total discount:{" "}
              <b>{money(success.discountAmount)}</b> · Profit:{" "}
              <b>{money(success.profit)}</b>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.9fr]">
        <section className="card p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search product name, SKU or product code..."
                className="w-full rounded-2xl bg-slate-100 py-3 pl-10 pr-3"
              />
            </div>
            <button
              type="button"
              onClick={() => searchProducts(query)}
              className="btn-soft"
              disabled={searching}
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="mt-4 max-h-[430px] overflow-y-auto rounded-2xl pr-1">
            <div className="grid gap-2 sm:grid-cols-2">
              {results.map((p) => (
                <button
                  type="button"
                  key={p._id}
                  onClick={() => chooseProduct(p)}
                  className={`rounded-2xl border p-3 text-left transition hover:shadow ${selectedProduct?._id === p._id ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}
                >
                  <div className="font-black">{p.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    SKU: {p.sku}
                    {p.productCode && <> · Code: {p.productCode}</>}
                    {" · Stock: "}
                    {p.stockQuantity ?? 0}
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline gap-2 font-black">
                    {p.discountedPrice != null ? (
                      <>
                        <span>{money(p.discountedPrice)}</span>
                        <span className="text-xs font-semibold text-slate-400 line-through">
                          {money(p.sellingPrice)}
                        </span>
                      </>
                    ) : (
                      <span>{money(p.sellingPrice)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {!searching && !results.length && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">
              No available products found.
            </div>
          )}

          {selectedProduct && (
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-black">
                    {selectedProduct.name}
                  </div>
                  <div className="text-sm text-slate-500">
                    {selectedProduct.sku} · {money(productDiscountedPrice)} each
                    · {selectedProduct.stockQuantity ?? 0} in stock
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-soft"
                  onClick={() => setSelectedProduct(null)}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {selectedProduct.colors?.length > 0 && (
                  <label className="text-sm font-bold">
                    Color
                    <select
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="mt-2 w-full rounded-2xl bg-white p-3 ring-1 ring-black/5"
                    >
                      <option value="">Select color</option>
                      {selectedProduct.colors.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {selectedProduct.sizes?.length > 0 && (
                  <label className="text-sm font-bold">
                    Size
                    <select
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="mt-2 w-full rounded-2xl bg-white p-3 ring-1 ring-black/5"
                    >
                      <option value="">Select size</option>
                      {selectedProduct.sizes.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div>
                  <div className="text-sm font-bold">Quantity</div>
                  <div className="mt-2 flex h-[50px] items-center justify-between rounded-2xl bg-white p-1 ring-1 ring-black/5">
                    <button
                      type="button"
                      onClick={() => changeAddQuantity(quantity - 1)}
                      disabled={quantity <= 1}
                      className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100 disabled:opacity-30"
                    >
                      <Minus size={17} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={selectedProduct.stockQuantity ?? 1}
                      step="1"
                      value={quantity}
                      onChange={(e) => changeAddQuantity(e.target.value)}
                      className="w-14 bg-transparent text-center font-black outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => changeAddQuantity(quantity + 1)}
                      disabled={
                        quantity >= Number(selectedProduct.stockQuantity ?? 1)
                      }
                      className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100 disabled:opacity-30"
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={addToCart}
                className="btn-primary mt-4 w-full sm:w-auto"
              >
                <ShoppingCart size={17} /> Add to Cart
              </button>
            </div>
          )}
        </section>

        <form onSubmit={createOrder} className="card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Cart</h2>
            <span className="badge">
              {cart.reduce((n, x) => n + x.quantity, 0)} items
            </span>
          </div>

          {cart.length ? (
            <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-1">
              {cart.map((item, index) => {
                const lineGross = roundMoney(item.sellingPrice * item.quantity);
                const lineNet = roundMoney(
                  item.discountedPrice * item.quantity,
                );
                const lineDiscount = roundMoney(
                  Math.max(0, lineGross - lineNet),
                );

                return (
                  <div
                    key={item.key}
                    className="group rounded-3xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-black">
                              {item.name}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              SKU: {item.sku}
                              {item.productCode && (
                                <> · Code: {item.productCode}</>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCart((c) =>
                                c.filter((x) => x.key !== item.key),
                              )
                            }
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${item.name}`}
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {(item.color || item.size) && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.color && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                Color: {item.color}
                              </span>
                            )}
                            {item.size && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                                Size: {item.size}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Quantity
                            </div>
                            <div className="mt-1 flex items-center gap-1 rounded-2xl bg-slate-50 p-1 ring-1 ring-slate-200">
                              <button
                                type="button"
                                className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white disabled:opacity-30"
                                disabled={item.quantity <= 1}
                                onClick={() =>
                                  updateCartQty(item.key, item.quantity - 1)
                                }
                                aria-label="Decrease quantity"
                              >
                                <Minus size={15} />
                              </button>
                              <input
                                value={item.quantity}
                                onChange={(e) =>
                                  updateCartQty(item.key, e.target.value)
                                }
                                className="w-10 bg-transparent text-center text-sm font-black outline-none"
                                inputMode="numeric"
                                aria-label={`Quantity for ${item.name}`}
                              />
                              <button
                                type="button"
                                className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white disabled:opacity-30"
                                disabled={item.quantity >= item.stockQuantity}
                                onClick={() =>
                                  updateCartQty(item.key, item.quantity + 1)
                                }
                                aria-label="Increase quantity"
                              >
                                <Plus size={15} />
                              </button>
                            </div>
                          </div>

                          <div className="ml-auto text-right">
                            {lineDiscount > 0 && (
                              <div className="text-xs text-slate-400 line-through">
                                {money(lineGross)}
                              </div>
                            )}
                            <div className="text-lg font-black">
                              {money(lineNet)}
                            </div>
                            {lineDiscount > 0 && (
                              <div className="text-[11px] font-bold text-emerald-600">
                                Save {money(lineDiscount)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <ShoppingCart className="mx-auto text-slate-300" size={34} />
              <div className="mt-3 font-black text-slate-600">
                Your cart is empty
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Search for a product and add it to start the bill.
              </div>
            </div>
          )}

          <div className="mt-5 border-t pt-5">
            <div className="flex justify-between text-sm">
              <span>Subtotal (Selling Price)</span>
              <b>{money(subtotal)}</b>
            </div>
            {productDiscount > 0 && (
              <>
                <div className="mt-2 flex justify-between text-sm text-emerald-700">
                  <span>Product Discount</span>
                  <b>− {money(productDiscount)}</b>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span>After Product Discount</span>
                  <b>{money(discountedSubtotal)}</b>
                </div>
              </>
            )}

            <label className="mt-4 block text-sm font-black">
              Final Total / Sale Amount
              <input
                required
                type="number"
                min="0"
                max={discountedSubtotal}
                step="0.01"
                value={finalTotal}
                onChange={(e) => changeFinalTotal(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-slate-100 p-4 text-xl font-black"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Default is the product-discounted total. If you reduce it
                further, that difference becomes an additional discount.
              </span>
            </label>

            {(productDiscount > 0 || additionalDiscount > 0) && (
              <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
                {productDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Product Discount</span>
                    <b>− {money(productDiscount)}</b>
                  </div>
                )}
                {additionalDiscount > 0 && (
                  <div className="flex justify-between">
                    <span>Additional Discount</span>
                    <b>− {money(additionalDiscount)}</b>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-black">
                  <span>Total Discount</span>
                  <b>− {money(totalDiscount)}</b>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Gross Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm text-slate-300">
                <span>Total Discount</span>
                <span>− {money(totalDiscount)}</span>
              </div>
              <div className="mt-2 flex justify-between text-lg font-black">
                <span>Revenue</span>
                <span>{money(effectiveFinal)}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Customer Name
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
                  placeholder="Optional"
                />
              </label>
              <label className="text-sm font-bold">
                Phone
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
                  placeholder="Optional"
                />
              </label>
            </div>

            <label className="mt-3 block text-sm font-bold">
              Payment Method
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
              >
                {["Cash", "UPI", "Card", "Bank Transfer", "Other"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-sm font-bold">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="2"
                className="mt-2 w-full rounded-2xl bg-slate-100 p-3"
                placeholder="Optional order notes"
              />
            </label>

            <button
              disabled={saving || !cart.length}
              className="btn-primary mt-5 w-full justify-center"
            >
              {saving ? "Creating Order..." : "Create Order"}
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={alertModal.open}
        title={alertModal.title}
        message={alertModal.message}
        confirmText="Okay"
        onConfirm={closeAlert}
        onClose={closeAlert}
        showCancel={false}
        danger={false}
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, Search, Plus, Minus, Trash2, PackageCheck, RefreshCw } from "lucide-react";

const money = value => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD"
}).format(Number(value));

function ProductArt({ name }) {
  const initials = name.split(" ").slice(0, 2).map(word => word[0]).join("").toUpperCase();
  return <div className="product-art" aria-label={`${name} image placeholder`}>{initials}</div>;
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [productResponse, orderResponse] = await Promise.all([
        fetch("/api/products"), fetch("/api/orders")
      ]);
      if (!productResponse.ok || !orderResponse.ok) throw new Error("Could not load shop data. Check that both backend services are running.");
      const [productData, orderData] = await Promise.all([productResponse.json(), orderResponse.json()]);
      setProducts(productData);
      setOrders(orderData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filteredProducts = useMemo(() => products.filter(product =>
    `${product.name} ${product.description}`.toLowerCase().includes(search.toLowerCase())
  ), [products, search]);

  const cartItems = products.filter(product => cart[product.id] > 0);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const total = cartItems.reduce((sum, product) => sum + Number(product.price) * cart[product.id], 0);

  function changeQuantity(product, delta) {
    setCart(current => {
      const next = { ...current };
      const quantity = (next[product.id] || 0) + delta;
      if (quantity <= 0) delete next[product.id];
      else if (quantity <= product.stock) next[product.id] = quantity;
      return next;
    });
  }

  async function checkout(event) {
    event.preventDefault();
    if (!customerName.trim() || !itemCount) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          items: cartItems.map(product => ({ productId: product.id, quantity: cart[product.id] }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout failed");
      setCart({});
      setCustomerName("");
      setNotice(`Order #${data.id} placed successfully.`);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><ShoppingBag size={19}/></span> mini<span>shop</span></a>
        <div className="topbar-right">
          <span className="status-dot"/> Demo storefront
          <a className="cart-link" href="#cart"><ShoppingBag size={18}/> Cart <b>{itemCount}</b></a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">THE EVERYDAY TECH STORE</p>
            <h1>Good gear.<br/><span>Better work.</span></h1>
            <p className="hero-copy">Thoughtful tech essentials for your desk, your workflow, and everywhere in between.</p>
            <a className="primary-link" href="#products">Explore products <span>→</span></a>
          </div>
          <div className="hero-graphic" aria-hidden="true">
            <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
            <div className="hero-device"><ShoppingBag size={76} strokeWidth={1.1}/></div>
            <span className="float-tag tag-one">DESIGNED FOR WORK</span>
            <span className="float-tag tag-two">LESS NOISE. MORE FOCUS.</span>
          </div>
        </section>

        {(error || notice) && <div className={error ? "alert error" : "alert success"} role="status">{error || notice}</div>}

        <section className="section" id="products">
          <div className="section-heading">
            <div><p className="eyebrow">CURATED FOR YOUR SETUP</p><h2>Shop essentials</h2></div>
            <label className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." aria-label="Search products"/></label>
          </div>
          {loading ? <div className="empty-state"><RefreshCw className="spin"/> Loading products...</div> :
            filteredProducts.length === 0 ? <div className="empty-state">No products found.</div> :
            <div className="product-grid">
              {filteredProducts.map(product => (
                <article className="product-card" key={product.id}>
                  <div className="product-visual"><ProductArt name={product.name}/><span className="stock-pill">{product.stock > 0 ? `${product.stock} in stock` : "Sold out"}</span></div>
                  <div className="product-info">
                    <div><h3>{product.name}</h3><p>{product.description}</p></div>
                    <div className="product-bottom"><strong>{money(product.price)}</strong>
                      <button className="add-button" onClick={() => changeQuantity(product, 1)} disabled={product.stock === 0 || (cart[product.id] || 0) >= product.stock} aria-label={`Add ${product.name} to cart`}><Plus size={17}/></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          }
        </section>

        <section className="lower-grid">
          <section className="panel" id="cart">
            <div className="panel-heading"><div><p className="eyebrow">READY WHEN YOU ARE</p><h2>Your cart <span className="count-badge">{itemCount}</span></h2></div><ShoppingBag size={22}/></div>
            {cartItems.length === 0 ? <p className="muted empty-cart">Your cart is empty. Add something you like.</p> :
              <div className="cart-list">
                {cartItems.map(product => <div className="cart-row" key={product.id}>
                  <div className="cart-thumb"><ProductArt name={product.name}/></div>
                  <div className="cart-name"><b>{product.name}</b><small>{money(product.price)} each</small></div>
                  <div className="quantity-control">
                    <button onClick={() => changeQuantity(product, -1)} aria-label={`Decrease ${product.name}`}><Minus size={13}/></button>
                    <span>{cart[product.id]}</span>
                    <button onClick={() => changeQuantity(product, 1)} disabled={cart[product.id] >= product.stock} aria-label={`Increase ${product.name}`}><Plus size={13}/></button>
                  </div>
                  <button className="remove-button" onClick={() => setCart(current => { const next = {...current}; delete next[product.id]; return next; })} aria-label={`Remove ${product.name}`}><Trash2 size={15}/></button>
                </div>)}
              </div>
            }
            <div className="cart-total"><span>Subtotal</span><strong>{money(total)}</strong></div>
            <form onSubmit={checkout} className="checkout-form">
              <label htmlFor="customerName">Your name</label>
              <input id="customerName" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Enter your name" required/>
              <button className="checkout-button" disabled={!itemCount || !customerName.trim() || submitting}>{submitting ? "Placing order..." : "Place demo order"} <span>→</span></button>
            </form>
            <p className="fine-print">Demo checkout only. No payment is collected.</p>
          </section>

          <section className="panel orders-panel">
            <div className="panel-heading"><div><p className="eyebrow">WHAT'S HAPPENING</p><h2>Recent orders</h2></div><PackageCheck size={22}/></div>
            {orders.length === 0 ? <p className="muted empty-cart">No orders yet. Your first order will appear here.</p> :
              <div className="orders-list">{orders.slice(0, 6).map(order => <div className="order-row" key={order.id}>
                <div className="order-icon"><PackageCheck size={18}/></div>
                <div className="order-details"><b>Order #{order.id}</b><small>{order.customerName} · {new Date(order.createdAt).toLocaleString()}</small></div>
                <div className="order-price"><b>{money(order.total)}</b><small>{order.status}</small></div>
              </div>)}</div>
            }
            <button className="refresh-button" onClick={loadData}><RefreshCw size={15}/> Refresh orders</button>
          </section>
        </section>
      </main>
      <footer><span className="brand small">mini<span>shop</span></span><span>Demo application · Built for DevOps practice</span></footer>
    </div>
  );
}

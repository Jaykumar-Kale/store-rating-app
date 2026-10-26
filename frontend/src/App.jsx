import { useEffect, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationMessage = data.errors?.map((item) => item.msg).join(" ");
    throw new Error(
      data.message ||
        validationMessage ||
        `Request failed (${response.status}).`,
    );
  }

  return data;
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("storeRatingSession")) || null;
  } catch {
    return null;
  }
}

function ratingText(value) {
  return Number(value || 0).toFixed(2);
}

function queryString(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

function App() {
  const [session, setSession] = useState(readSession);
  const [authMode, setAuthMode] = useState("login");
  const [view, setView] = useState("overview");
  const [data, setData] = useState({
    dashboard: null,
    stores: [],
    users: [],
  });
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [storeFilters, setStoreFilters] = useState({});
  const [userFilters, setUserFilters] = useState({});
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!session) return undefined;

    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        if (session.user.role === "system_admin") {
          const [dashboard, stores, users] = await Promise.all([
            api("/admin/dashboard", { token: session.token }),
            api(`/admin/stores${queryString(storeFilters)}`, {
              token: session.token,
            }),
            api(`/admin/users${queryString(userFilters)}`, {
              token: session.token,
            }),
          ]);

          if (active) {
            setData({
              dashboard,
              stores: stores.stores,
              users: users.users,
            });
          }
        } else if (session.user.role === "normal_user") {
          const params = new URLSearchParams();
          if (search) params.set("search", search);
          const suffix = params.toString() ? `?${params.toString()}` : "";
          const result = await api(`/stores${suffix}`, {
            token: session.token,
          });

          if (active)
            setData({ dashboard: null, stores: result.stores, users: [] });
        } else {
          const result = await api("/owner/dashboard", {
            token: session.token,
          });

          if (active) {
            setData({ dashboard: null, stores: result.stores, users: [] });
          }
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [session, refresh, search, storeFilters, userFilters]);

  async function submitAuth(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const values = Object.fromEntries(new FormData(event.currentTarget));

    try {
      if (authMode === "register") {
        await api("/auth/register", { method: "POST", body: values });
        setAuthMode("login");
        setNotice("Account created. Sign in with your new account.");
        return;
      }

      const result = await api("/auth/login", {
        method: "POST",
        body: values,
      });

      const nextSession = { token: result.token, user: result.user };
      localStorage.setItem("storeRatingSession", JSON.stringify(nextSession));
      setSession(nextSession);
      setView("overview");
      setNotice("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function logout() {
    localStorage.removeItem("storeRatingSession");
    setSession(null);
    setData({ dashboard: null, stores: [], users: [] });
    setError("");
    setNotice("");
  }

  async function submitRating(storeId) {
    const value = Number(
      ratingDrafts[storeId] ??
        data.stores.find((store) => store.id === storeId)?.user_rating,
    );

    if (!value || value < 1 || value > 5) {
      setError("Choose a rating from 1 to 5 first.");
      return;
    }

    setError("");
    setNotice("");

    try {
      await api(`/stores/${storeId}/rating`, {
        method: "PUT",
        token: session.token,
        body: { rating: value },
      });
      setNotice("Your rating was saved.");
      setRefresh((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function createAdminUser(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));

    try {
      await api("/admin/users", {
        method: "POST",
        token: session.token,
        body: values,
      });
      form.reset();
      setNotice("User created.");
      setRefresh((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function createStore(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (values.owner_id) values.owner_id = Number(values.owner_id);
    else delete values.owner_id;

    try {
      await api("/admin/stores", {
        method: "POST",
        token: session.token,
        body: values,
      });
      form.reset();
      setNotice("Store created.");
      setRefresh((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));

    try {
      const result = await api("/auth/password", {
        method: "PUT",
        token: session.token,
        body: values,
      });
      form.reset();
      setNotice(result.message || "Password updated.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark">SR</div>
          <p className="eyebrow">STORE RATING PLATFORM</p>
          <h1>
            {authMode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="muted">
            {authMode === "login"
              ? "Sign in to discover and rate local stores."
              : "Join the platform and share your store experience."}
          </p>

          {error && <div className="alert error">{error}</div>}
          {notice && <div className="alert success">{notice}</div>}

          <form className="form-stack" onSubmit={submitAuth}>
            {authMode === "register" && (
              <>
                <label>
                  Full name
                  <input
                    name="name"
                    required
                    minLength="20"
                    maxLength="60"
                    placeholder="Your full name (20–60 characters)"
                  />
                </label>
                <label>
                  Address
                  <textarea
                    name="address"
                    required
                    maxLength="400"
                    rows="2"
                    placeholder="Your address"
                  />
                </label>
              </>
            )}

            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <input
                name="password"
                type="password"
                required
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                minLength={authMode === "register" ? 8 : undefined}
                maxLength={authMode === "register" ? 16 : undefined}
                pattern={
                  authMode === "register"
                    ? "(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}"
                    : undefined
                }
                title="Use 8–16 characters, including an uppercase letter and a special character."
                placeholder="Enter your password"
              />
            </label>

            <button className="button primary full" type="submit">
              {authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            {authMode === "login"
              ? "New to the platform?"
              : "Already registered?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setError("");
                setNotice("");
              }}
              type="button"
            >
              {authMode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </section>
      </main>
    );
  }

  const role = session.user.role;
  const roleName =
    role === "system_admin"
      ? "System administrator"
      : role === "store_owner"
        ? "Store owner"
        : "Normal user";

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(event) => event.preventDefault()}
        >
          <span className="brand-mark small">SR</span>
          <span>StoreRate</span>
        </a>

        <div className="topbar-right">
          <div className="user-chip">
            <span className="avatar">{session.user.name?.[0] || "U"}</span>
            <span>
              <strong>{session.user.name}</strong>
              <small>{roleName}</small>
            </span>
          </div>
          <button className="button secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">{roleName}</p>
            <h1>
              {role === "system_admin"
                ? "Platform overview"
                : role === "store_owner"
                  ? "Your store dashboard"
                  : "Discover stores"}
            </h1>
            <p className="muted">
              {role === "system_admin"
                ? "Manage users, stores, and platform activity."
                : role === "store_owner"
                  ? "See your store performance and customer ratings."
                  : "Find a store and share your experience."}
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => setRefresh((current) => current + 1)}
          >
            Refresh
          </button>
        </div>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}
        {loading && <div className="loading">Loading your dashboard…</div>}

        {role === "system_admin" && (
          <>
            <nav className="tabs">
              {[
                ["overview", "Overview"],
                ["stores", "Stores"],
                ["users", "Users"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={view === key ? "tab active" : "tab"}
                  onClick={() => setView(key)}
                >
                  {label}
                </button>
              ))}
            </nav>

            {view === "overview" && (
              <section className="stat-grid">
                <StatCard
                  label="Total users"
                  value={data.dashboard?.totalUsers ?? "—"}
                />
                <StatCard
                  label="Total stores"
                  value={data.dashboard?.totalStores ?? "—"}
                />
                <StatCard
                  label="Submitted ratings"
                  value={data.dashboard?.totalRatings ?? "—"}
                />
              </section>
            )}

            {view === "stores" && (
              <>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Stores</h2>
                      <p className="muted">
                        Filter and sort the registered stores.
                      </p>
                    </div>
                  </div>
                  <form
                    className="filter-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setStoreFilters(
                        Object.fromEntries(new FormData(event.currentTarget)),
                      );
                    }}
                  >
                    <input name="name" placeholder="Filter by name" />
                    <input name="email" placeholder="Filter by email" />
                    <input name="address" placeholder="Filter by address" />
                    <select name="sortBy" defaultValue="name">
                      <option value="name">Sort: name</option>
                      <option value="email">Sort: email</option>
                      <option value="address">Sort: address</option>
                      <option value="rating">Sort: rating</option>
                    </select>
                    <select name="sortOrder" defaultValue="asc">
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                    <button className="button primary">Apply</button>
                  </form>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Address</th>
                          <th>Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.stores.map((store) => (
                          <tr key={store.id}>
                            <td>
                              <strong>{store.name}</strong>
                            </td>
                            <td>{store.email}</td>
                            <td>{store.address}</td>
                            <td>
                              <Rating value={store.rating} />
                            </td>
                          </tr>
                        ))}
                        {!data.stores.length && (
                          <EmptyRow columns={4} message="No stores found." />
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="panel">
                  <h2>Add a store</h2>
                  <form className="form-grid" onSubmit={createStore}>
                    <label>
                      Store name
                      <input name="name" required maxLength="120" />
                    </label>
                    <label>
                      Store email
                      <input name="email" type="email" required />
                    </label>
                    <label>
                      Address
                      <input name="address" required maxLength="400" />
                    </label>
                    <label>
                      Owner user ID (optional)
                      <input name="owner_id" type="number" min="1" />
                    </label>
                    <button className="button primary">Create store</button>
                  </form>
                </section>
              </>
            )}

            {view === "users" && (
              <>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Users</h2>
                      <p className="muted">
                        Filter users and sort by a key field.
                      </p>
                    </div>
                  </div>
                  <form
                    className="filter-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setUserFilters(
                        Object.fromEntries(new FormData(event.currentTarget)),
                      );
                    }}
                  >
                    <input name="name" placeholder="Filter by name" />
                    <input name="email" placeholder="Filter by email" />
                    <input name="address" placeholder="Filter by address" />
                    <select name="role" defaultValue="">
                      <option value="">All roles</option>
                      <option value="system_admin">System admin</option>
                      <option value="normal_user">Normal user</option>
                      <option value="store_owner">Store owner</option>
                    </select>
                    <select name="sortBy" defaultValue="name">
                      <option value="name">Sort: name</option>
                      <option value="email">Sort: email</option>
                      <option value="address">Sort: address</option>
                      <option value="role">Sort: role</option>
                      <option value="rating">Sort: rating</option>
                    </select>
                    <select name="sortOrder" defaultValue="asc">
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                    <button className="button primary">Apply</button>
                  </form>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Address</th>
                          <th>Role</th>
                          <th>Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.users.map((user) => (
                          <tr key={user.id}>
                            <td>
                              <strong>{user.name}</strong>
                            </td>
                            <td>{user.email}</td>
                            <td>{user.address}</td>
                            <td>
                              <span className="role-tag">
                                {user.role.replaceAll("_", " ")}
                              </span>
                            </td>
                            <td>
                              {user.role === "store_owner" ? (
                                <Rating value={user.rating} />
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                        {!data.users.length && (
                          <EmptyRow columns={5} message="No users found." />
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="panel">
                  <h2>Add a user</h2>
                  <form className="form-grid" onSubmit={createAdminUser}>
                    <label>
                      Name
                      <input
                        name="name"
                        required
                        minLength="20"
                        maxLength="60"
                      />
                    </label>
                    <label>
                      Email
                      <input name="email" type="email" required />
                    </label>
                    <label>
                      Address
                      <input name="address" required maxLength="400" />
                    </label>
                    <label>
                      Password
                      <input
                        name="password"
                        type="password"
                        required
                        minLength="8"
                        maxLength="16"
                        pattern="(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}"
                      />
                    </label>
                    <label>
                      Role
                      <select name="role" required>
                        <option value="normal_user">Normal user</option>
                        <option value="store_owner">Store owner</option>
                        <option value="system_admin">
                          System administrator
                        </option>
                      </select>
                    </label>
                    <button className="button primary">Create user</button>
                  </form>
                </section>
              </>
            )}
          </>
        )}

        {role === "normal_user" && (
          <>
            <form
              className="search-bar"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(
                  new FormData(event.currentTarget).get("search").trim(),
                );
              }}
            >
              <input
                name="search"
                placeholder="Search by store name or address"
              />
              <button className="button primary">Search stores</button>
            </form>

            <section className="store-grid">
              {data.stores.map((store) => (
                <article className="store-card" key={store.id}>
                  <div className="store-card-top">
                    <div>
                      <p className="eyebrow">REGISTERED STORE</p>
                      <h2>{store.name}</h2>
                      <p className="muted">{store.address}</p>
                    </div>
                    <Rating value={store.overall_rating} />
                  </div>
                  <div className="rating-footer">
                    <span>
                      Your rating:{" "}
                      <strong>{store.user_rating ?? "Not rated"}</strong>
                    </span>
                    <div className="rating-actions">
                      <select
                        aria-label={`Your rating for ${store.name}`}
                        value={
                          ratingDrafts[store.id] ?? store.user_rating ?? ""
                        }
                        onChange={(event) =>
                          setRatingDrafts({
                            ...ratingDrafts,
                            [store.id]: event.target.value,
                          })
                        }
                      >
                        <option value="">Choose 1–5</option>
                        {[1, 2, 3, 4, 5].map((number) => (
                          <option key={number} value={number}>
                            {number} star{number > 1 ? "s" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        className="button primary"
                        onClick={() => submitRating(store.id)}
                      >
                        {store.user_rating ? "Update rating" : "Submit rating"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!data.stores.length && !loading && (
                <div className="panel">No stores match that search.</div>
              )}
            </section>
          </>
        )}

        {role === "store_owner" && (
          <section className="owner-grid">
            {data.stores.map((store) => (
              <article className="panel owner-card" key={store.id}>
                <div className="owner-heading">
                  <div>
                    <p className="eyebrow">YOUR STORE</p>
                    <h2>{store.name}</h2>
                    <p className="muted">{store.address}</p>
                  </div>
                  <div className="average-box">
                    <strong>{ratingText(store.average_rating)}</strong>
                    <span>Average rating</span>
                  </div>
                </div>
                <h3>Customer ratings</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Rating</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.ratings.map((rating) => (
                        <tr key={`${rating.userId}-${rating.submittedAt}`}>
                          <td>{rating.name}</td>
                          <td>{rating.email}</td>
                          <td>
                            <Rating value={rating.rating} />
                          </td>
                          <td>
                            {new Date(rating.submittedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                      {!store.ratings.length && (
                        <EmptyRow
                          columns={4}
                          message="No ratings submitted yet."
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
            {!data.stores.length && !loading && (
              <div className="panel">
                No store is assigned to this account yet.
              </div>
            )}
          </section>
        )}

        <details className="panel password-panel">
          <summary>Change password</summary>
          <form className="form-grid password-form" onSubmit={changePassword}>
            <label>
              Current password
              <input name="currentPassword" type="password" required />
            </label>
            <label>
              New password
              <input
                name="newPassword"
                type="password"
                required
                minLength="8"
                maxLength="16"
                pattern="(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}"
              />
            </label>
            <button className="button secondary">Update password</button>
          </form>
          <p className="hint">
            Use 8–16 characters, including an uppercase letter and a special
            character.
          </p>
        </details>
      </main>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Rating({ value }) {
  return (
    <span className="rating-pill">
      <span aria-hidden="true">★</span> {ratingText(value)}
    </span>
  );
}

function EmptyRow({ columns, message }) {
  return (
    <tr>
      <td className="empty-row" colSpan={columns}>
        {message}
      </td>
    </tr>
  );
}

export default App;

import React, { useState, useEffect, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const INVITE_CODE = "NEIGHBOR2026";

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [messages, setMessages] = useState([]);
  const [repliesByMsg, setRepliesByMsg] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [replyText, setReplyText] = useState({});
  const [openReplyFor, setOpenReplyFor] = useState(null);

  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const replyUnsubs = useRef({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        const pref = doc(db, "profiles", u.uid);
        const snap = await getDoc(pref);
        if (snap.exists()) setProfile(snap.data());
        else setProfile({ displayName: u.email, email: u.email });
      } else {
        setProfile(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setMessages(list);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    messages.forEach((m) => {
      if (replyUnsubs.current[m.id]) return;
      const rq = query(
        collection(db, "messages", m.id, "replies"),
        orderBy("createdAt", "asc")
      );
      const unsub = onSnapshot(rq, (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setRepliesByMsg((prev) => ({ ...prev, [m.id]: arr }));
      });
      replyUnsubs.current[m.id] = unsub;
    });
  }, [messages, user]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSignIn(e) {
    e.preventDefault();
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setAuthError(err.message.replace("Firebase: ", ""));
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setAuthError("");
    if (inviteInput.trim() !== INVITE_CODE) {
      setAuthError("Invalid invite code.");
      return;
    }
    if (!displayName.trim()) {
      setAuthError("Please enter a display name.");
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      await setDoc(doc(db, "profiles", cred.user.uid), {
        displayName: displayName.trim(),
        email: email.trim(),
        createdAt: serverTimestamp(),
      });
      setToast("Welcome to the neighborhood!");
    } catch (err) {
      setAuthError(err.message.replace("Firebase: ", ""));
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setMenuOpen(false);
  }

  async function postMessage(e) {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !user) return;
    await addDoc(collection(db, "messages"), {
      text,
      authorUid: user.uid,
      authorName: profile?.displayName || user.email,
      createdAt: serverTimestamp(),
    });
    setNewMessage("");
    setToast("Posted!");
  }

  async function postReply(msgId) {
    const text = (replyText[msgId] || "").trim();
    if (!text || !user) return;
    await addDoc(collection(db, "messages", msgId, "replies"), {
      text,
      authorUid: user.uid,
      authorName: profile?.displayName || user.email,
      createdAt: serverTimestamp(),
    });
    setReplyText((prev) => ({ ...prev, [msgId]: "" }));
    setOpenReplyFor(null);
  }

  function fmtTime(ts) {
    if (!ts?.toDate) return "just now";
    const d = ts.toDate();
    return d.toLocaleString();
  }

  if (!authReady) {
    return (
      <div style={styles.loading}>
        <div>Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <h1 style={styles.title}>🏡 The Neighborhood Hangout</h1>
          <p style={styles.subtitle}>
            A quiet little bulletin board for our street.
          </p>

          <div style={styles.tabs}>
            <button
              onClick={() => {
                setMode("signin");
                setAuthError("");
              }}
              style={{
                ...styles.tab,
                ...(mode === "signin" ? styles.tabActive : {}),
              }}
            >
              Sign in
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setAuthError("");
              }}
              style={{
                ...styles.tab,
                ...(mode === "signup" ? styles.tabActive : {}),
              }}
            >
              Create account
            </button>
          </div>

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} style={styles.form}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
              {authError && <div style={styles.error}>{authError}</div>}
              <button type="submit" style={styles.primaryBtn}>
                Sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} style={styles.form}>
              <input
                type="text"
                placeholder="Display name (e.g. Emilee from #14)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={styles.input}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
              <input
                type="password"
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                minLength={6}
                required
              />
              <input
                type="text"
                placeholder="Neighborhood invite code"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                style={styles.input}
                required
              />
              {authError && <div style={styles.error}>{authError}</div>}
              <button type="submit" style={styles.primaryBtn}>
                Join the neighborhood
              </button>
            </form>
          )}
        </div>
        {toast && <div style={styles.toast}>{toast}</div>}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.brand}>🏡 The Neighborhood Hangout</h1>
          <div style={styles.hello}>
            Hi, {profile?.displayName || user.email}
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={styles.menuBtn}
          >
            ⋯
          </button>
          {menuOpen && (
            <div style={styles.menu}>
              <button onClick={handleLogout} style={styles.menuItem}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <form onSubmit={postMessage} style={styles.postCard}>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Share something with the neighborhood…"
          style={styles.textarea}
          rows={3}
        />
        <div style={styles.postRow}>
          <div style={styles.hint}>Be kind. Everyone on the street sees this.</div>
          <button type="submit" style={styles.primaryBtn} disabled={!newMessage.trim()}>
            Post
          </button>
        </div>
      </form>

      <div style={styles.feed}>
        {messages.length === 0 && (
          <div style={styles.empty}>No posts yet. Be the first to say hi 👋</div>
        )}
        {messages.map((m) => {
          const replies = repliesByMsg[m.id] || [];
          const isOpen = openReplyFor === m.id;
          return (
            <div key={m.id} style={styles.msgCard}>
              <div style={styles.msgHead}>
                <strong>{m.authorName}</strong>
                <span style={styles.time}>{fmtTime(m.createdAt)}</span>
              </div>
              <div style={styles.msgText}>{m.text}</div>

              {replies.length > 0 && (
                <div style={styles.replies}>
                  {replies.map((r) => (
                    <div key={r.id} style={styles.reply}>
                      <div style={styles.replyHead}>
                        <strong>{r.authorName}</strong>
                        <span style={styles.time}>{fmtTime(r.createdAt)}</span>
                      </div>
                      <div>{r.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {isOpen ? (
                <div style={{ marginTop: 10 }}>
                  <textarea
                    value={replyText[m.id] || ""}
                    onChange={(e) =>
                      setReplyText((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    placeholder="Write a reply…"
                    style={styles.textarea}
                    rows={2}
                  />
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end", justifyContent: "flex-end", marginTop: 6 }}>
                    <button onClick={() => setOpenReplyFor(null)} style={styles.ghostBtn}>
                      Cancel
                    </button>
                    <button
                      onClick={() => postReply(m.id)}
                      style={styles.primaryBtn}
                      disabled={!(replyText[m.id] || "").trim()}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setOpenReplyFor(m.id)}
                  style={styles.ghostBtn}
                >
                  Reply
                </button>
              )}
            </div>
          );
        })}
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={styles.overlay}
        />
      )}
    </div>
  );
}

const styles = {
  loading: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily: "system-ui, sans-serif",
    color: "#555",
  },
  authWrap: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #eaf3ff 0%, #fff 100%)",
    display: "grid",
    placeItems: "center",
    padding: 20,
    fontFamily: "system-ui, sans-serif",
  },
  authCard: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
  },
  title: { margin: 0, fontSize: 24, color: "#1a365d" },
  subtitle: { marginTop: 6, color: "#4a5568" },
  tabs: { display: "flex", gap: 8, marginTop: 18, marginBottom: 14 },
  tab: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f7fafc",
    cursor: "pointer",
    fontWeight: 500,
  },
  tabActive: { background: "#1a365d", color: "#fff", borderColor: "#1a365d" },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e0",
    fontSize: 15,
    outline: "none",
  },
  error: { color: "#c53030", fontSize: 14 },
  primaryBtn: {
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "#1a365d",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  ghostBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    cursor: "pointer",
    marginTop: 8,
  },
  page: {
    maxWidth: 680,
    margin: "0 auto",
    padding: 20,
    fontFamily: "system-ui, sans-serif",
    color: "#1a202c",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brand: { margin: 0, fontSize: 22, color: "#1a365d" },
  hello: { fontSize: 13, color: "#4a5568", marginTop: 2 },
  menuBtn: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 18,
  },
  menu: {
    position: "absolute",
    right: 0,
    top: "110%",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    overflow: "hidden",
    zIndex: 20,
  },
  menuItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "10px 14px",
    background: "#fff",
    border: "none",
    cursor: "pointer",
  },
  postCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  textarea: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #cbd5e0",
    fontSize: 15,
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
  },
  postRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 10,
  },
  hint: { fontSize: 12, color: "#718096" },
  feed: { display: "flex", flexDirection: "column", gap: 14 },
  empty: {
    textAlign: "center",
    color: "#718096",
    padding: 30,
    border: "1px dashed #cbd5e0",
    borderRadius: 12,
  },
  msgCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
  },
  msgHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  time: { fontSize: 12, color: "#718096" },
  msgText: { whiteSpace: "pre-wrap", lineHeight: 1.5 },
  replies: {
    marginTop: 12,
    paddingLeft: 12,
    borderLeft: "3px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  reply: {
    background: "#f7fafc",
    borderRadius: 10,
    padding: 10,
  },
  replyHead: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  toast: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1a365d",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 999,
    fontSize: 14,
    zIndex: 30,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "transparent",
    zIndex: 10,
  },
};

import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
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
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDocs,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "./firebase";

const INVITE_CODE = "NEIGHBOR2026";

const TABS = [
  { id: "board", label: "📋 Board" },
  { id: "lostfound", label: "🐾 Lost & Found" },
  { id: "forsale", label: "🏷️ For Sale / Free" },
  { id: "events", label: "📅 Events" },
  { id: "directory", label: "👥 Directory" },
  { id: "announcements", label: "📢 Announcements" },
  { id: "qrcode", label: "📱 QR Code" },
];

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

  const [activeTab, setActiveTab] = useState("board");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  // Board (messages + replies)
  const [messages, setMessages] = useState([]);
  const [repliesByMsg, setRepliesByMsg] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [replyText, setReplyText] = useState({});
  const [openReplyFor, setOpenReplyFor] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const replyUnsubs = useRef({});

  // Lost & Found
  const [lostItems, setLostItems] = useState([]);
  const [newLost, setNewLost] = useState({ title: "", description: "", status: "lost" });

  // For Sale / Free
  const [saleItems, setSaleItems] = useState([]);
  const [newSale, setNewSale] = useState({ title: "", description: "", price: "", isFree: false });

  // Events
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", date: "", location: "" });

  // Directory
  const [neighbors, setNeighbors] = useState([]);
  const [myEntry, setMyEntry] = useState({ lot: "", bio: "", pets: "", showEmail: false });
  const [editingDirectory, setEditingDirectory] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", body: "" });

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");

  // Image upload
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState("");

  const BOARD_CATEGORIES = ["all", "general", "help", "pets", "news", "other"];

  // Auth state
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

  // Board messages
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

  // Replies for board messages
  useEffect(() => {
    if (!user) return;
    messages.forEach((m) => {
      if (replyUnsubs.current[m.id]) return;
      const rq = query(collection(db, "messages", m.id, "replies"), orderBy("createdAt", "asc"));
      const unsub = onSnapshot(rq, (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setRepliesByMsg((prev) => ({ ...prev, [m.id]: arr }));
      });
      replyUnsubs.current[m.id] = unsub;
    });
    return () => {
      Object.values(replyUnsubs.current).forEach((u) => u());
      replyUnsubs.current = {};
    };
  }, [messages, user]);

  // Lost & Found
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "lostfound"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setLostItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  // For Sale
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "forsale"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setSaleItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  // Events
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "events"), orderBy("date", "asc"));
    return onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  // Directory
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "directory"), orderBy("lot", "asc"));
    return onSnapshot(q, (snap) => {
      setNeighbors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  // My directory entry
  useEffect(() => {
    if (!user) return;
    const d = doc(db, "directory", user.uid);
    getDoc(d).then((snap) => {
      if (snap.exists()) setMyEntry(snap.data());
    });
  }, [user]);

  // Announcements
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  // Toast auto-dismiss
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
    if (inviteInput !== INVITE_CODE) {
      setAuthError("Invalid invite code. Please check with a neighbor.");
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
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

  async function handleUpdateProfile(e) {
    e.preventDefault();
    if (!newDisplayName.trim()) return;
    await setDoc(doc(db, "profiles", user.uid), { ...profile, displayName: newDisplayName.trim() }, { merge: true });
    await updateProfile(user, { displayName: newDisplayName.trim() });
    setProfile((p) => ({ ...p, displayName: newDisplayName.trim() }));
    setEditingProfile(false);
    setToast("Profile updated!");
  }

  async function postMessage(e) {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !user) return;
    await addDoc(collection(db, "messages"), {
      text,
      category: activeCategory === "all" ? "general" : activeCategory,
      authorUid: user.uid,
      authorName: profile?.displayName || user.email,
      imageUrl: pendingImageUrl || "",
      likes: [],
      createdAt: serverTimestamp(),
    });
    setNewMessage("");
    setPendingImageUrl("");
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
    setReplyText((p) => ({ ...p, [msgId]: "" }));
    setOpenReplyFor(null);
    setToast("Reply posted!");
  }

  async function toggleLike(msgId, likes) {
    const ref2 = doc(db, "messages", msgId);
    if (likes && likes.includes(user.uid)) {
      await updateDoc(ref2, { likes: arrayRemove(user.uid) });
    } else {
      await updateDoc(ref2, { likes: arrayUnion(user.uid) });
    }
  }

  async function deleteMessage(msgId) {
    if (!window.confirm("Delete this post?")) return;
    await deleteDoc(doc(db, "messages", msgId));
    setToast("Post deleted.");
  }

  async function deleteReply(msgId, replyId) {
    if (!window.confirm("Delete this reply?")) return;
    await deleteDoc(doc(db, "messages", msgId, "replies", replyId));
    setToast("Reply deleted.");
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `images/${user.uid}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPendingImageUrl(url);
      setToast("Image ready!");
    } catch (err) {
      setToast("Image upload failed: " + err.message);
    }
    setUploadingImage(false);
  }

  async function postLostItem(e) {
    e.preventDefault();
    if (!newLost.title.trim()) return;
    await addDoc(collection(db, "lostfound"), {
      ...newLost,
      authorUid: user.uid,
      authorName: profile?.displayName || user.email,
      createdAt: serverTimestamp(),
    });
    setNewLost({ title: "", description: "", status: "lost" });
    setToast("Posted to Lost & Found!");
  }

  async function deleteLostItem(id) {
    if (!window.confirm("Remove this item?")) return;
    await deleteDoc(doc(db, "lostfound", id));
    setToast("Removed.");
  }

  async function postSaleItem(e) {
    e.preventDefault();
    if (!newSale.title.trim()) return;
    await addDoc(collection(db, "forsale"), {
      ...newSale,
      authorUid: user.uid,
      authorName: profile?.displayName || user.email,
      createdAt: serverTimestamp(),
    });
    setNewSale({ title: "", description: "", price: "", isFree: false });
    setToast("Posted to For Sale!");
  }

  async function deleteSaleItem(id) {
    if (!window.confirm("Remove this listing?")) return;
    await deleteDoc(doc(db, "forsale", id));
    setToast("Removed.");
  }

  async function postEvent(e) {
    e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.date) return;
    await addDoc(collection(db, "events"), {
      ...newEvent,
      authorUid: user.uid,
      authorName: profile?.displayName || user.email,
      rsvps: [],
      createdAt: serverTimestamp(),
    });
    setNewEvent({ title: "", description: "", date: "", location: "" });
    setToast("Event added!");
  }

  async function toggleRsvp(eventId, rsvps) {
    const ref2 = doc(db, "events", eventId);
    if (rsvps && rsvps.includes(user.uid)) {
      await updateDoc(ref2, { rsvps: arrayRemove(user.uid) });
    } else {
      await updateDoc(ref2, { rsvps: arrayUnion(user.uid) });
    }
  }

  async function deleteEvent(id) {
    if (!window.confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", id));
    setToast("Event deleted.");
  }

  async function saveDirectoryEntry(e) {
    e.preventDefault();
    await setDoc(doc(db, "directory", user.uid), {
      ...myEntry,
      uid: user.uid,
      displayName: profile?.displayName || user.email,
    });
    setEditingDirectory(false);
    setToast("Directory updated!");
  }

  async function postAnnouncement(e) {
    e.preventDefault();
    if (!newAnnouncement.title.trim()) return;
    await addDoc(collection(db, "announcements"), {
      ...newAnnouncement,
      authorUid: user.uid,
      authorName: profile?.displayName || user.email,
      createdAt: serverTimestamp(),
    });
    setNewAnnouncement({ title: "", body: "" });
    setToast("Announcement posted!");
  }

  async function deleteAnnouncement(id) {
    if (!window.confirm("Delete announcement?")) return;
    await deleteDoc(doc(db, "announcements", id));
    setToast("Deleted.");
  }

  function fmt(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  }

  if (!authReady) return <div style={styles.loading}>Loading...</div>;

  if (!user) {
    return (
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <h1 style={styles.title}>🏠 The Neighborhood Hangout</h1>
          <p style={styles.subtitle}>Lake Valley RV Community</p>
          <div style={styles.tabs}>
            <button onClick={() => { setMode("signin"); setAuthError(""); }} style={{ ...styles.tab, ...(mode === "signin" ? styles.tabActive : {}) }}>Sign in</button>
            <button onClick={() => { setMode("signup"); setAuthError(""); }} style={{ ...styles.tab, ...(mode === "signup" ? styles.tabActive : {}) }}>Create account</button>
          </div>
          {mode === "signin" ? (
            <form onSubmit={handleSignIn} style={styles.form}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required />
              {authError && <div style={styles.error}>{authError}</div>}
              <button type="submit" style={styles.primaryBtn}>Sign In</button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} style={styles.form}>
              <input type="text" placeholder="Your name (e.g. Waite at 808)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={styles.input} required />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} required />
              <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} required />
              <input type="text" placeholder="Invite code" value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} style={styles.input} required />
              {authError && <div style={styles.error}>{authError}</div>}
              <button type="submit" style={styles.primaryBtn}>Create Account</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Filtered messages for board
  const filteredMessages = messages.filter((m) => {
    const matchTab = activeCategory === "all" || m.category === activeCategory;
    const matchSearch = !search || m.text.toLowerCase().includes(search.toLowerCase()) || (m.authorName || "").toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div style={styles.appWrap}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>🏠 The Neighborhood Hangout</h1>
          <div style={styles.headerSub}>Hi, {profile?.displayName || user.email}</div>
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen((v) => !v)} style={styles.menuBtn}>⋯</button>
          {menuOpen && (
            <div style={styles.menu}>
              <button onClick={() => { setEditingProfile(true); setNewDisplayName(profile?.displayName || ""); setMenuOpen(false); }} style={styles.menuItem}>✏️ Edit Profile</button>
              <button onClick={handleLogout} style={styles.menuItem}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      {/* Profile Edit Modal */}
      {editingProfile && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Edit Profile</h2>
            <form onSubmit={handleUpdateProfile}>
              <input type="text" placeholder="Display name (e.g. Waite at 808)" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} style={styles.input} required />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="submit" style={styles.primaryBtn}>Save</button>
                <button type="button" onClick={() => setEditingProfile(false)} style={styles.secondaryBtn}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab Nav */}
      <nav style={styles.tabNav}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ ...styles.navTab, ...(activeTab === t.id ? styles.navTabActive : {}) }}>{t.label}</button>
        ))}
      </nav>

      {toast && <div style={styles.toast}>{toast}</div>}
      {menuOpen && <div onClick={() => setMenuOpen(false)} style={styles.overlay} />}

      <main style={styles.main}>
        {/* ===== BOARD TAB ===== */}
        {activeTab === "board" && (
          <div>
            {/* Search + Category Filter */}
            <div style={styles.filterRow}>
              <input type="text" placeholder="🔍 Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...styles.input, marginBottom: 0, flex: 1 }} />
            </div>
            <div style={styles.categoryRow}>
              {BOARD_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setActiveCategory(c)} style={{ ...styles.catBtn, ...(activeCategory === c ? styles.catBtnActive : {}) }}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>
              ))}
            </div>
            {/* New Post Form */}
            <form onSubmit={postMessage} style={styles.postcard}>
              <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Share something with the neighborhood..." style={styles.textarea} rows={3} />
              {pendingImageUrl && <img src={pendingImageUrl} alt="preview" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 8 }} />}
              <div style={styles.postRow}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={activeCategory === "all" ? "general" : activeCategory} onChange={(e) => setActiveCategory(e.target.value)} style={styles.select}>
                    {BOARD_CATEGORIES.filter((c) => c !== "all").map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.secondaryBtn} disabled={uploadingImage}>📷 {uploadingImage ? "Uploading..." : "Photo"}</button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
                </div>
                <div style={styles.hint}>Be kind. Everyone sees this.</div>
                <button type="submit" style={styles.primaryBtn} disabled={!newMessage.trim()}>Post</button>
              </div>
            </form>
            {/* Messages Feed */}
            <div style={styles.feed}>
              {filteredMessages.length === 0 && <div style={styles.empty}>No posts yet. Be the first! 👋</div>}
              {filteredMessages.map((m) => (
                <div key={m.id} style={styles.msgCard}>
                  <div style={styles.msgHeader}>
                    <strong>{m.authorName}</strong>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={styles.catTag}>{m.category || "general"}</span>
                      <span style={styles.ts}>{fmt(m.createdAt)}</span>
                    </div>
                  </div>
                  <div style={styles.msgBody}>{m.text}</div>
                  {m.imageUrl && <img src={m.imageUrl} alt="" style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }} />}
                  <div style={styles.msgActions}>
                    <button onClick={() => toggleLike(m.id, m.likes)} style={styles.likeBtn}>{m.likes && m.likes.includes(user.uid) ? "❤️" : "🤍"} {(m.likes || []).length}</button>
                    <button onClick={() => setOpenReplyFor(openReplyFor === m.id ? null : m.id)} style={styles.replyBtn}>💬 Reply</button>
                    {m.authorUid === user.uid && <button onClick={() => deleteMessage(m.id)} style={styles.deleteBtn}>🗑️</button>}
                  </div>
                  {openReplyFor === m.id && (
                    <div style={styles.replyBox}>
                      <textarea value={replyText[m.id] || ""} onChange={(e) => setReplyText((p) => ({ ...p, [m.id]: e.target.value }))} placeholder="Write a reply..." style={{ ...styles.textarea, fontSize: 13 }} rows={2} />
                      <button onClick={() => postReply(m.id)} style={styles.primaryBtn} disabled={!(replyText[m.id] || "").trim()}>Post Reply</button>
                    </div>
                  )}
                  {(repliesByMsg[m.id] || []).map((r) => (
                    <div key={r.id} style={styles.replyCard}>
                      <div style={styles.msgHeader}><strong>{r.authorName}</strong><span style={styles.ts}>{fmt(r.createdAt)}</span></div>
                      <div style={styles.msgBody}>{r.text}</div>
                      {r.authorUid === user.uid && <button onClick={() => deleteReply(m.id, r.id)} style={styles.deleteBtn}>🗑️</button>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== LOST & FOUND TAB ===== */}
        {activeTab === "lostfound" && (
          <div>
            <h2 style={styles.sectionTitle}>🐾 Lost & Found</h2>
            <form onSubmit={postLostItem} style={styles.postcard}>
              <div style={styles.formRow}>
                <input type="text" placeholder="Title (e.g. Lost cat - orange tabby)" value={newLost.title} onChange={(e) => setNewLost((p) => ({ ...p, title: e.target.value }))} style={{ ...styles.input, flex: 2 }} required />
                <select value={newLost.status} onChange={(e) => setNewLost((p) => ({ ...p, status: e.target.value }))} style={{ ...styles.select, flex: 1 }}>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
              </div>
              <textarea value={newLost.description} onChange={(e) => setNewLost((p) => ({ ...p, description: e.target.value }))} placeholder="Description, where last seen, contact info..." style={styles.textarea} rows={3} />
              <button type="submit" style={styles.primaryBtn}>Post</button>
            </form>
            <div style={styles.feed}>
              {lostItems.length === 0 && <div style={styles.empty}>Nothing posted yet 🙌</div>}
              {lostItems.map((item) => (
                <div key={item.id} style={styles.msgCard}>
                  <div style={styles.msgHeader}>
                    <strong>{item.title}</strong>
                    <span style={{ ...styles.catTag, background: item.status === "lost" ? "#fee2e2" : "#dcfce7", color: item.status === "lost" ? "#991b1b" : "#166534" }}>{item.status.toUpperCase()}</span>
                  </div>
                  <div style={styles.msgBody}>{item.description}</div>
                  <div style={styles.msgHeader}><span style={styles.ts}>Posted by {item.authorName} · {fmt(item.createdAt)}</span>
                    {item.authorUid === user.uid && <button onClick={() => deleteLostItem(item.id)} style={styles.deleteBtn}>🗑️ Remove</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== FOR SALE / FREE TAB ===== */}
        {activeTab === "forsale" && (
          <div>
            <h2 style={styles.sectionTitle}>🏷️ For Sale / Free Stuff</h2>
            <form onSubmit={postSaleItem} style={styles.postcard}>
              <input type="text" placeholder="Item name" value={newSale.title} onChange={(e) => setNewSale((p) => ({ ...p, title: e.target.value }))} style={styles.input} required />
              <textarea value={newSale.description} onChange={(e) => setNewSale((p) => ({ ...p, description: e.target.value }))} placeholder="Description, condition, pickup details..." style={styles.textarea} rows={3} />
              <div style={styles.formRow}>
                <input type="text" placeholder="Price (e.g. $10)" value={newSale.price} onChange={(e) => setNewSale((p) => ({ ...p, price: e.target.value }))} style={{ ...styles.input, flex: 1 }} disabled={newSale.isFree} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={newSale.isFree} onChange={(e) => setNewSale((p) => ({ ...p, isFree: e.target.checked, price: e.target.checked ? "FREE" : "" }))} />
                  Free item
                </label>
              </div>
              <button type="submit" style={styles.primaryBtn}>Post Listing</button>
            </form>
            <div style={styles.feed}>
              {saleItems.length === 0 && <div style={styles.empty}>No listings yet!</div>}
              {saleItems.map((item) => (
                <div key={item.id} style={styles.msgCard}>
                  <div style={styles.msgHeader}>
                    <strong>{item.title}</strong>
                    <span style={{ ...styles.catTag, background: item.isFree ? "#d1fae5" : "#fef9c3", color: item.isFree ? "#065f46" : "#713f12" }}>{item.isFree ? "FREE" : item.price}</span>
                  </div>
                  <div style={styles.msgBody}>{item.description}</div>
                  <div style={styles.msgHeader}><span style={styles.ts}>Posted by {item.authorName} · {fmt(item.createdAt)}</span>
                    {item.authorUid === user.uid && <button onClick={() => deleteSaleItem(item.id)} style={styles.deleteBtn}>🗑️ Remove</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== EVENTS TAB ===== */}
        {activeTab === "events" && (
          <div>
            <h2 style={styles.sectionTitle}>📅 Events & Hangouts</h2>
            <form onSubmit={postEvent} style={styles.postcard}>
              <input type="text" placeholder="Event title (e.g. BBQ at the pavilion)" value={newEvent.title} onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))} style={styles.input} required />
              <textarea value={newEvent.description} onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))} placeholder="Details..." style={styles.textarea} rows={2} />
              <div style={styles.formRow}>
                <input type="datetime-local" value={newEvent.date} onChange={(e) => setNewEvent((p) => ({ ...p, date: e.target.value }))} style={{ ...styles.input, flex: 1 }} required />
                <input type="text" placeholder="Location (e.g. Lot 808, Pavilion)" value={newEvent.location} onChange={(e) => setNewEvent((p) => ({ ...p, location: e.target.value }))} style={{ ...styles.input, flex: 1 }} />
              </div>
              <button type="submit" style={styles.primaryBtn}>Add Event</button>
            </form>
            <div style={styles.feed}>
              {events.length === 0 && <div style={styles.empty}>No upcoming events. Plan something! 🎉</div>}
              {events.map((ev) => (
                <div key={ev.id} style={styles.msgCard}>
                  <div style={styles.msgHeader}>
                    <strong>{ev.title}</strong>
                    <span style={styles.ts}>{ev.date ? new Date(ev.date).toLocaleString() : ""}</span>
                  </div>
                  {ev.location && <div style={{ fontSize: 13, color: "#4a5568", marginBottom: 4 }}>📍 {ev.location}</div>}
                  <div style={styles.msgBody}>{ev.description}</div>
                  <div style={styles.msgActions}>
                    <button onClick={() => toggleRsvp(ev.id, ev.rsvps)} style={{ ...styles.primaryBtn, fontSize: 13, padding: "4px 12px" }}>
                      {ev.rsvps && ev.rsvps.includes(user.uid) ? "✅ Going" : "➕ RSVP"}
                    </button>
                    <span style={styles.ts}>{(ev.rsvps || []).length} going</span>
                    {ev.authorUid === user.uid && <button onClick={() => deleteEvent(ev.id)} style={styles.deleteBtn}>🗑️</button>}
                  </div>
                  <div style={styles.ts}>Posted by {ev.authorName}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== DIRECTORY TAB ===== */}
        {activeTab === "directory" && (
          <div>
            <h2 style={styles.sectionTitle}>👥 Neighbor Directory</h2>
            <div style={styles.postcard}>
              {!editingDirectory ? (
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 14, color: "#4a5568" }}>Add yourself so neighbors can find you! Only shown to logged-in members.</p>
                  <button onClick={() => setEditingDirectory(true)} style={styles.secondaryBtn}>{myEntry.lot ? "✏️ Update My Info" : "➕ Add Myself"}</button>
                </div>
              ) : (
                <form onSubmit={saveDirectoryEntry}>
                  <input type="text" placeholder="Lot # (e.g. 808)" value={myEntry.lot} onChange={(e) => setMyEntry((p) => ({ ...p, lot: e.target.value }))} style={styles.input} required />
                  <textarea value={myEntry.bio} onChange={(e) => setMyEntry((p) => ({ ...p, bio: e.target.value }))} placeholder="About you (optional)" style={styles.textarea} rows={2} />
                  <input type="text" placeholder="Pets (e.g. 2 dogs: Max & Bella)" value={myEntry.pets} onChange={(e) => setMyEntry((p) => ({ ...p, pets: e.target.value }))} style={styles.input} />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={myEntry.showEmail} onChange={(e) => setMyEntry((p) => ({ ...p, showEmail: e.target.checked }))} />
                    Show my email to neighbors
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" style={styles.primaryBtn}>Save</button>
                    <button type="button" onClick={() => setEditingDirectory(false)} style={styles.secondaryBtn}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
            <div style={styles.feed}>
              {neighbors.length === 0 && <div style={styles.empty}>No one in the directory yet. Add yourself! 👋</div>}
              {neighbors.map((n) => (
                <div key={n.id} style={styles.msgCard}>
                  <div style={styles.msgHeader}>
                    <strong>{n.displayName}</strong>
                    {n.lot && <span style={styles.catTag}>Lot {n.lot}</span>}
                  </div>
                  {n.bio && <div style={styles.msgBody}>{n.bio}</div>}
                  {n.pets && <div style={{ fontSize: 13, color: "#4a5568" }}>🐾 {n.pets}</div>}
                  {n.showEmail && n.uid !== user.uid && <div style={{ fontSize: 13, color: "#4a5568" }}>✉️ {profile?.email}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== ANNOUNCEMENTS TAB ===== */}
        {activeTab === "announcements" && (
          <div>
            <h2 style={styles.sectionTitle}>📢 Announcements</h2>
            <form onSubmit={postAnnouncement} style={styles.postcard}>
              <input type="text" placeholder="Title (e.g. Water shutoff Thursday 9am)" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement((p) => ({ ...p, title: e.target.value }))} style={styles.input} required />
              <textarea value={newAnnouncement.body} onChange={(e) => setNewAnnouncement((p) => ({ ...p, body: e.target.value }))} placeholder="Details..." style={styles.textarea} rows={3} />
              <button type="submit" style={styles.primaryBtn}>Post Announcement</button>
            </form>
            <div style={styles.feed}>
              {announcements.length === 0 && <div style={styles.empty}>No announcements yet.</div>}
              {announcements.map((a) => (
                <div key={a.id} style={{ ...styles.msgCard, borderLeft: "4px solid #f59e0b" }}>
                  <div style={styles.msgHeader}>
                    <strong>{a.title}</strong>
                    <span style={styles.ts}>{fmt(a.createdAt)}</span>
                  </div>
                  <div style={styles.msgBody}>{a.body}</div>
                  <div style={styles.msgHeader}><span style={styles.ts}>Posted by {a.authorName}</span>
                    {a.authorUid === user.uid && <button onClick={() => deleteAnnouncement(a.id)} style={styles.deleteBtn}>🗑️</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== QR CODE TAB ===== */}
        {activeTab === "qrcode" && (
          <div style={{ textAlign: "center", padding: "24px 16px" }}>
            <h2 style={styles.sectionTitle}>📱 Share The Neighborhood Hangout</h2>
            <p style={{ color: "#4a5568", fontSize: 14, marginBottom: 24 }}>
              Scan this QR code to open the app, or share the link below with neighbors.
            </p>
            <div style={{ display: "inline-block", background: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.10)", marginBottom: 24 }}>
              <QRCodeSVG
                value="https://the-neighborhood-hangout.vercel.app"
                size={240}
                fgColor="#1a365d"
                bgColor="#ffffff"
                level="H"
                includeMargin={true}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: "#718096", marginBottom: 8 }}>Direct link:</p>
              <a href="https://the-neighborhood-hangout.vercel.app" target="_blank" rel="noreferrer"
                style={{ color: "#1a365d", fontWeight: 600, fontSize: 15, wordBreak: "break-all" }}>
                the-neighborhood-hangout.vercel.app
              </a>
            </div>
            <p style={{ fontSize: 13, color: "#a0aec0", marginTop: 16 }}>
              Remember: only share the invite code (<strong>NEIGHBOR2026</strong>) with residents you know.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  loading: { minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", color: "#555" },
  authWrap: { minHeight: "100vh", background: "linear-gradient(180deg, #eaf3ff 0%, #fff 100%)", display: "grid", placeItems: "center", padding: 20, fontFamily: "system-ui, sans-serif" },
  authCard: { width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" },
  title: { margin: 0, fontSize: 24, color: "#1a365d" },
  subtitle: { marginTop: 6, color: "#4a5568", fontSize: 14 },
  tabs: { display: "flex", gap: 8, marginTop: 18, marginBottom: 14 },
  tab: { flex: 1, padding: "8px 0", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f7fafc", cursor: "pointer", fontSize: 14 },
  tabActive: { background: "#1a365d", color: "#fff", border: "1px solid #1a365d" },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: { padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", marginBottom: 4 },
  error: { color: "#e53e3e", fontSize: 13, padding: "6px 10px", background: "#fff5f5", borderRadius: 6 },
  primaryBtn: { padding: "10px 18px", background: "#1a365d", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 },
  secondaryBtn: { padding: "10px 18px", background: "#e2e8f0", color: "#1a365d", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  appWrap: { fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7fafc" },
  header: { background: "#1a365d", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerLeft: {},
  headerTitle: { margin: 0, fontSize: 18, fontWeight: 700 },
  headerSub: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  menuBtn: { background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", padding: "4px 8px" },
  menu: { position: "absolute", right: 0, top: "110%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, minWidth: 180, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100 },
  menuItem: { display: "block", width: "100%", padding: "10px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#1a365d" },
  tabNav: { display: "flex", overflowX: "auto", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 12px", gap: 4 },
  navTab: { padding: "10px 14px", background: "none", border: "none", borderBottom: "3px solid transparent", cursor: "pointer", fontSize: 13, color: "#4a5568", whiteSpace: "nowrap" },
  navTabActive: { borderBottom: "3px solid #1a365d", color: "#1a365d", fontWeight: 600 },
  main: { maxWidth: 700, margin: "0 auto", padding: "16px 12px" },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: "#1a365d", marginBottom: 12 },
  postcard: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  textarea: { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 8 },
  postRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  hint: { fontSize: 12, color: "#a0aec0" },
  feed: { display: "flex", flexDirection: "column", gap: 12 },
  empty: { textAlign: "center", color: "#a0aec0", padding: 32, fontSize: 14 },
  msgCard: { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  msgHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8, flexWrap: "wrap" },
  msgBody: { fontSize: 15, color: "#2d3748", lineHeight: 1.5, marginBottom: 8 },
  ts: { fontSize: 12, color: "#a0aec0" },
  catTag: { fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#e2e8f0", color: "#4a5568" },
  msgActions: { display: "flex", gap: 8, alignItems: "center", marginTop: 4 },
  likeBtn: { background: "none", border: "1px solid #e2e8f0", borderRadius: 20, padding: "3px 10px", cursor: "pointer", fontSize: 13 },
  replyBtn: { background: "none", border: "1px solid #e2e8f0", borderRadius: 20, padding: "3px 10px", cursor: "pointer", fontSize: 13, color: "#4a5568" },
  deleteBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#e53e3e", padding: "3px 6px" },
  replyBox: { marginTop: 10, padding: "10px", background: "#f7fafc", borderRadius: 8 },
  replyCard: { marginTop: 8, padding: "10px 12px", background: "#f7fafc", borderRadius: 8 },
  filterRow: { display: "flex", gap: 8, marginBottom: 8 },
  categoryRow: { display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" },
  catBtn: { padding: "4px 12px", border: "1px solid #e2e8f0", borderRadius: 20, background: "#fff", cursor: "pointer", fontSize: 12, color: "#4a5568" },
  catBtnActive: { background: "#1a365d", color: "#fff", border: "1px solid #1a365d" },
  select: { padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" },
  formRow: { display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a365d", color: "#fff", padding: "10px 24px", borderRadius: 24, fontSize: 14, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" },
  overlay: { position: "fixed", inset: 0, zIndex: 50 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 200 },
  modal: { background: "#fff", borderRadius: 16, padding: 24, width: "90%", maxWidth: 400 },
  modalTitle: { margin: "0 0 16px", fontSize: 18, color: "#1a365d" },
};

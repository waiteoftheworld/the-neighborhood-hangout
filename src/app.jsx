import { useState, useEffect, useRef } from "react";
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
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const DEFAULT_INVITE = "NEIGHBOR2026";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #F5F0E8;
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
  }
  .nb-wrap {
    min-height: 100vh;
    background: #F5F0E8;
    background-image:
      radial-gradient(ellipse at 20% 10%, rgba(139,164,95,0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 90%, rgba(210,175,90,0.12) 0%, transparent 50%);
  }
  .nb-card {
    background: #FFFDF7;
    border-radius: 20px;
    box-shadow: 0 4px 24px rgba(60,50,20,0.10), 0 1px 4px rgba(60,50,20,0.06);
    border: 1px solid rgba(180,160,100,0.18);
  }
  .nb-title { font-family: 'Fraunces', serif; color: #2C3E1A; }
  .nb-btn-primary {
    background: #3D6B1F; color: #fff; border: none; border-radius: 12px;
    padding: 12px 24px; font-family: 'DM Sans', sans-serif; font-size: 15px;
    font-weight: 600; cursor: pointer; transition: background 0.2s, transform 0.1s;
    width: 100%;
  }
  .nb-btn-primary:hover { background: #2D5016; }
  .nb-btn-primary:active { transform: scale(0.98); }
  .nb-btn-primary:disabled { cursor: not-allowed; }
  .nb-btn-ghost {
    background: transparent; color: #3D6B1F; border: 1.5px solid #3D6B1F;
    border-radius: 12px; padding: 11px 24px; font-family: 'DM Sans', sans-serif;
    font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s;
  }
  .nb-btn-ghost:hover { background: #f0f5ea; }
  .nb-input, .nb-textarea {
    width: 100%; background: #F8F5EE; border: 1.5px solid #D9D0BC;
    border-radius: 12px; padding: 12px 16px; font-family: 'DM Sans', sans-serif;
    font-size: 15px; color: #1C1C1C; outline: none; transition: border-color 0.2s;
  }
  .nb-textarea { resize: none; min-height: 80px; }
  .nb-input:focus, .nb-textarea:focus { border-color: #3D6B1F; background: #FFFDF7; }
  .nb-input::placeholder, .nb-textarea::placeholder { color: #AAA096; }
  .nb-error {
    background: #FFF1EE; border: 1px solid #E8A090; color: #C0392B;
    border-radius: 10px; padding: 10px 14px; font-size: 14px;
  }
  .nb-avatar {
    width: 36px; height: 36px; border-radius: 50%; color: white;
    font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .nb-reply-avatar { width: 28px; height: 28px; font-size: 13px; }
  .nb-message { animation: slideIn 0.3s ease; }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .nb-reply-btn {
    background: none; border: none; color: #7A9A52;
    font-family: 'DM Sans', sans-serif; font-size: 13px; cursor: pointer;
    padding: 4px 8px; border-radius: 6px; transition: background 0.15s; font-weight: 500;
  }
  .nb-reply-btn:hover { background: #EDF3E6; color: #3D6B1F; }
  .nb-invite-pill {
    background: #EDF3E6; border: 1.5px dashed #7A9A52; border-radius: 10px;
    padding: 8px 14px; font-family: 'DM Sans', monospace; font-size: 14px;
    color: #3D6B1F; font-weight: 600; letter-spacing: 1px; cursor: pointer; user-select: all;
  }
  .nb-tag-link { color: #5584A0; text-decoration: none; cursor: pointer; font-size: 13px; }
  .nb-tag-link:hover { text-decoration: underline; }
  .nb-time { font-size: 12px; color: #B0A898; }
  .nb-divider { border: none; border-top: 1px solid #EDE8DC; margin: 4px 0; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D0C9B8; border-radius: 3px; }
  .nb-header-bar {
    background: #FFFDF7; border-bottom: 1px solid #EDE8DC;
    box-shadow: 0 1px 8px rgba(60,50,20,0.06);
    position: sticky; top: 0; z-index: 10;
  }
  .nb-copy-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #2D5016; color: white; padding: 10px 20px; border-radius: 20px;
    font-size: 14px; font-family: 'DM Sans', sans-serif; z-index: 999;
    animation: toastIn 0.25s ease;
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
`;

function getAvatarColor(name) {
  const colors = ["#3D6B1F", "#5584A0", "#A06B30", "#7A52A0", "#A03050", "#2D8060"];
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + hash * 31;
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ name, className = "" }) {
  const label = (name || "?").trim() || "?";
  return (
    <div
      className={`nb-avatar ${className}`}
      style={{ background: getAvatarColor(label) }}
    >
      {label[0].toUpperCase()}
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return "just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function App() {
  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null); // { uid, displayName }
  const [messages, setMessages] = useState([]);
  const [repliesByMsg, setRepliesByMsg] = useState({});
  const [authReady, setAuthReady] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ displayName: "", email: "", password: "", invite: "" });
  const [newMsg, setNewMsg] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [toast, setToast] = useState("");
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const replyInputRef = useRef(null);

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        let name = u.displayName;
        if (!name) {
          try {
            const snap = await getDoc(doc(db, "profiles", u.uid));
            if (snap.exists()) name = snap.data().displayName;
          } catch {}
        }
        setCurrentUser({ uid: u.uid, displayName: name || u.email.split("@")[0] });
        setScreen("board");
      } else {
        setCurrentUser(null);
        setScreen("login");
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Live messages subscription
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentUser]);

  // Live replies for each message
  useEffect(() => {
    if (!currentUser || messages.length === 0) return;
    const unsubs = messages.map((m) => {
      const q = query(collection(db, "messages", m.id, "replies"), orderBy("createdAt", "asc"));
      return onSnapshot(q, (snap) => {
        setRepliesByMsg((prev) => ({
          ...prev,
          [m.id]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        }));
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [currentUser, messages.map((m) => m.id).join(",")]);

  useEffect(() => {
    if (replyingTo && replyInputRef.current) replyInputRef.current.focus();
  }, [replyingTo]);

  const showToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const authErrorMessage = (err) => {
    const code = err?.code || "";
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
      return "Incorrect email or password.";
    if (code.includes("email-already-in-use")) return "An account already exists for that email.";
    if (code.includes("invalid-email")) return "That doesn't look like a valid email.";
    if (code.includes("weak-password")) return "Password must be at least 6 characters.";
    if (code.includes("network")) return "Network issue — please check your connection.";
    return "Something went wrong. Please try again.";
  };

  const handleLogin = async () => {
    setError("");
    if (!loginForm.email.trim() || !loginForm.password) {
      setError("Please enter your email and password.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, loginForm.email.trim(), loginForm.password);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  const handleRegister = async () => {
    setError("");
    const { displayName, email, password, invite } = regForm;
    if (!displayName.trim() || !email.trim() || !password || !invite.trim()) {
      setError("All fields are required.");
      return;
    }
    if (invite.trim().toUpperCase() !== DEFAULT_INVITE.toUpperCase()) {
      setError("That invite code isn't right. Check with your neighbor!");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
      await setDoc(doc(db, "profiles", cred.user.uid), {
        displayName: displayName.trim(),
        createdAt: serverTimestamp(),
      });
      setCurrentUser({ uid: cred.user.uid, displayName: displayName.trim() });
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  const handlePost = async () => {
    if (!newMsg.trim() || !currentUser) return;
    const text = newMsg.trim();
    setNewMsg("");
    try {
      await addDoc(collection(db, "messages"), {
        text,
        author: currentUser.displayName,
        authorUid: currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch {
      setNewMsg(text);
      showToast("Couldn't post — try again");
    }
  };

  const handleReply = async (msgId) => {
    if (!replyText.trim() || !currentUser) return;
    const text = replyText.trim();
    setReplyText("");
    setReplyingTo(null);
    try {
      await addDoc(collection(db, "messages", msgId, "replies"), {
        text,
        author: currentUser.displayName,
        authorUid: currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch {
      setReplyText(text);
      setReplyingTo(msgId);
      showToast("Couldn't reply — try again");
    }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(DEFAULT_INVITE).then(() => showToast("Invite code copied!"));
  };

  if (!authReady) {
    return (
      <div className="nb-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <style>{STYLES}</style>
        <div className="nb-title" style={{ fontSize: 24 }}>Loading your neighborhood…</div>
      </div>
    );
  }

  // AUTH SCREENS
  if (!currentUser) {
    return (
      <div className="nb-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px 16px" }}>
        <style>{STYLES}</style>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏡</div>
            <h1 className="nb-title" style={{ fontSize: 32, fontWeight: 700 }}>The Neighborhood Hangout</h1>
            <p style={{ color: "#7A7060", fontSize: 15, marginTop: 6 }}>Your community, your conversations.</p>
          </div>
          <div className="nb-card" style={{ padding: 32 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <button
                onClick={() => { setScreen("login"); setError(""); }}
                style={{
                  flex: 1, padding: "10px", border: "none", borderRadius: 10,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  background: screen === "login" ? "#3D6B1F" : "#F5F0E8",
                  color: screen === "login" ? "white" : "#7A7060",
                }}
              >Sign In</button>
              <button
                onClick={() => { setScreen("register"); setError(""); }}
                style={{
                  flex: 1, padding: "10px", border: "none", borderRadius: 10,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  background: screen === "register" ? "#3D6B1F" : "#F5F0E8",
                  color: screen === "register" ? "white" : "#7A7060",
                }}
              >Join</button>
            </div>

            {error && <div className="nb-error" style={{ marginBottom: 16 }}>{error}</div>}

            {screen === "login" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <input
                  className="nb-input" type="email" placeholder="Email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email:

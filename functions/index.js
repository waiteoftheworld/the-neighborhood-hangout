const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

async function notify({ kind, excludeUid, onlyUid, title, body, tag }) {
  const docs = onlyUid
  ? [await db.doc("pushTokens/" + onlyUid).get()]
    : (await db.collection("pushTokens").get()).docs;

const owners = {};
  docs.forEach((d) => {
    if (!d.exists || d.id === excludeUid) return;
    const data = d.data();
    const tokens = data.tokens || [];
    const pref = data.pref || "all";
    if (pref === "off") return;
    if (pref === "replies" && kind !== "reply") return;
    tokens.forEach((t) => { owners[t] = d.id; });
  });
  const tokens = Object.keys(owners);
  if (!tokens.length) return;

const payload = { title: title, body: String(body || "").slice(0, 140), tag: tag, link: "/" };
  const dead = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await getMessaging().sendEachForMulticast({ tokens: chunk, data: payload });
    res.responses.forEach((r, j) => {
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") dead.push(chunk[j]);
    });
  }
  await Promise.all(dead.map((t) =>
    db.doc("pushTokens/" + owners[t]).update({ tokens: FieldValue.arrayRemove(t) })
                             ));
}

exports.onNewMessage = onDocumentCreated("messages/{id}", (event) => {
  const m = event.data.data();
  return notify({
    kind: "post",
    excludeUid: m.authorUid,
    title: (m.authorName || "A neighbor") + " posted on the Board",
    body: m.text,
    tag: "board",
  });
});

exports.onNewReply = onDocumentCreated("messages/{id}/replies/{rid}", async (event) => {
  const r = event.data.data();
  const parent = await db.doc("messages/" + event.params.id).get();
  if (!parent.exists || parent.data().authorUid === r.authorUid) return;
  return notify({
    kind: "reply",
    onlyUid: parent.data().authorUid,
    title: (r.authorName || "A neighbor") + " replied to your post",
    body: r.text,
    tag: "reply-" + event.params.id,
  });
});

exports.onNewAnnouncement = onDocumentCreated("announcements/{id}", (event) => {
  const a = event.data.data();
  return notify({
    kind: "post",
    excludeUid: a.authorUid,
    title: "Announcement: " + (a.title || "New announcement"),
    body: a.body || "",
    tag: "announcement",
  });
});

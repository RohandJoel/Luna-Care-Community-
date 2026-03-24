import { auth, db } from "./firebase-config.js";
import { collection, getDocs, getDocsFromServer, getDoc, addDoc, doc, updateDoc, increment, query, where, serverTimestamp, deleteDoc, onSnapshot, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// CONFIG — change this to your backend URL
// ════════════════════════════════════════════════════════
const API = 'http://localhost:4000/api';

// ── State ──────────────────────────────────────────────
let currentTopic = 'all';
let resourceCategory = '';
let searchTimeout;
let discussionSearchTimeout;
let discussionSearchQuery = '';
let commentsModalPostId = null; // post id for which comments modal is open
let unsubscribePosts = null;
let lastVisiblePost = null;
const POSTS_PER_PAGE = 10;
let currentThreadPostId = null;
// Pages that don't require sign-in (home + discussions only)
const PUBLIC_PAGES = ['home', 'community'];

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  currentTopic = localStorage.getItem('femcare-topic') || 'all';
  initReveal();
  initTips();
  loadPosts();
  loadResources();
  loadStories();
  loadStats();
});

// Nav: when not signed in show only Home + Discussions; protect other pages
onAuthStateChanged(auth, async (user) => {
  const btn = document.getElementById('nav-signin');
  const userBox = document.getElementById('nav-user-box');
  const userAvatar = document.getElementById('nav-user-avatar');
  const userNameEl = document.getElementById('nav-user-name');
  const navResources = document.getElementById('nav-resources');
  const navStories = document.getElementById('nav-stories');
  const navSaved = document.getElementById('nav-saved');
  const hideNavItem = (el) => { if (el && el.closest('li')) el.closest('li').style.display = 'none'; };
  const showNavItem = (el) => { if (el && el.closest('li')) el.closest('li').style.display = ''; };
  const postBox = document.getElementById('community-post-box');
  const askBtn = document.getElementById('community-ask-btn');
  if (user) {
    showNavItem(navResources);
    showNavItem(navStories);
    showNavItem(navSaved);
    if (postBox) postBox.style.display = '';
    if (askBtn) askBtn.style.display = '';
    let username = 'User';
    const q = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
    q.forEach(d => { username = d.data().username || 'User'; });
    if (userBox) {
      userBox.style.display = 'flex';
      if (userAvatar) userAvatar.textContent = (username || 'U').charAt(0).toUpperCase();
      if (userNameEl) userNameEl.textContent = username;
    }
    if (btn) btn.style.display = 'none';
  } else {
    hideNavItem(navResources);
    hideNavItem(navStories);
    hideNavItem(navSaved);
    if (postBox) postBox.style.display = 'none';
    if (askBtn) askBtn.style.display = 'none';
    if (userBox) userBox.style.display = 'none';
    if (btn) {
      btn.style.display = '';
      btn.innerText = 'Sign In';
      btn.onclick = () => openModal('auth');
    }
  }
  // Restore saved page (persist across reload)
  const savedPage = localStorage.getItem('femcare-page');
  const allowed = !savedPage || PUBLIC_PAGES.includes(savedPage) || user;
  if (allowed && savedPage && document.getElementById('page-' + savedPage)) {
    showPage(savedPage, true);
    if (savedPage === 'community') restoreCommunityTab();
  }
});

function restoreCommunityTab() {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const tabBtn = document.querySelector(`.tab[onclick*="'${currentTopic}'"]`);
  if (tabBtn) tabBtn.classList.add('active');
}

//LOGOUT//
window.logoutUser = async function(){

  await auth.signOut();

};

//SAVE BUTTON//
window.savePost = async function(postId){

const user = auth.currentUser;
if(!user) return alert("Sign in first");

const q = query(
collection(db,"savedPosts"),
where("postId","==",postId),
where("userId","==",user.uid)
);

const snap = await getDocs(q);

if(!snap.empty){
alert("Already saved");
return;
}

await addDoc(collection(db,"savedPosts"),{
postId:postId,
userId:user.uid
});

alert("Post saved 🔖");

}

// PAGES (only home + community without sign-in; others open auth modal)
window.showPage = function(page, skipGuard) {
  const user = auth.currentUser;
  if (!skipGuard && !user && !PUBLIC_PAGES.includes(page)) {
    openModal('auth');
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  if (page === 'saved') loadSavedPosts();
  if (page === 'profile') loadProfileData();
  document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + page);
  if (navBtn) navBtn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  try { localStorage.setItem('femcare-page', page); } catch (e) {}
}

// ── TOAST ──────────────────────────────────────────────
window.toast = function(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── AUTH ───────────────────────────────────────────────
window.switchAuthTab = function(tab) {
  document.querySelectorAll('.modal-tab').forEach((b,i) => b.classList.toggle('active', (tab==='login'&&i===0)||(tab==='register'&&i===1)));
  document.getElementById('authFormLogin').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('authFormRegister').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('authError').style.display = 'none';
}

window.doLogin = async function() {

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {

    const userCred = await signInWithEmailAndPassword(auth, email, password);

    closeModal("auth");

  } catch(e) {

    showModalError("authError", e.message);

  }

}

window.doRegister = async function(){

  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  try {

    const userCred = await createUserWithEmailAndPassword(auth,email,password);

    await addDoc(collection(db,"users"),{
      uid: userCred.user.uid,
      username: username,
      email: email
    });

    closeModal("auth");

  } catch(e){

    showModalError("authError",e.message);

  }

}

// ── STATS ──────────────────────────────────────────────
async function loadStats() {
  try {
    const [usersSnap, postsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'posts'))
    ]);
    const userCount = usersSnap.size;
    const postCount = postsSnap.size;
    if (userCount > 0) document.getElementById('statMembers').textContent = userCount.toLocaleString() + '+';
    if (postCount > 0) document.getElementById('statPosts').textContent   = postCount.toLocaleString() + '+';
  } catch(e) { console.error('Stats error:', e); }
}

// ── POSTS ──────────────────────────────────────────────
// Firebase: posts collection = { title, body, topic, isAnonymous, userId?, username?, likes, commentCount, createdAt }
//          posts/{postId}/comments subcollection = { text, isAnonymous, userId?, username?, createdAt }
async function loadPosts(loadMore = false) {
  const list = document.getElementById("discList");
  if (!list) return;

  if (!loadMore) {
    lastVisiblePost = null;
    list.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading discussions…</div>';
  }

  try {
    let q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(POSTS_PER_PAGE)
    );

    if (loadMore && lastVisiblePost) {
      q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisiblePost),
        limit(POSTS_PER_PAGE)
      );
    }

    const snap = await getDocsFromServer(q);

    if (snap.empty && !loadMore) {
      list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:32px;">No discussions yet. Be the first to ask!</p>';
      updateLoadMoreBtn(false);
      return;
    }

    if (!loadMore) list.innerHTML = '';

    let posts = [];
    snap.forEach(docu => {
      const p = docu.data();
      posts.push({
        id: docu.id,
        title: p.title || '',
        body: p.body || p.title || '',
        topic: p.topic || 'general',
        isAnonymous: p.isAnonymous === true,
        username: p.username || null,
        likes: p.likes || 0,
        commentCount: p.commentCount != null ? p.commentCount : 0,
        createdAt: p.createdAt ? (p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt)) : new Date()
      });
    });

    let filtered = currentTopic && currentTopic !== 'all'
      ? posts.filter(p => p.topic === currentTopic)
      : posts;

    const searchQ = (discussionSearchQuery || '').trim().toLowerCase();
    if (searchQ) filtered = filtered.filter(p => (p.title || '').toLowerCase().includes(searchQ));

    filtered.forEach(p => {
      addLocalPost(p.title, p.body, p.topic, p.isAnonymous, p.id, p.likes, p.commentCount, p.username);
    });

    lastVisiblePost = snap.docs[snap.docs.length - 1];
    updateLoadMoreBtn(snap.docs.length === POSTS_PER_PAGE);

  } catch(e) {
    console.error('loadPosts error:', e);
    if (!loadMore) list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:32px;">Could not load discussions.</p>';
  }
}

function startPostsListener() {
  if (unsubscribePosts) unsubscribePosts();

  const q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  let firstRun = true;

  unsubscribePosts = onSnapshot(q, (snap) => {
    if (firstRun) { firstRun = false; return; }
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const p = change.doc.data();
        const postId = change.doc.id;
        // Only prepend if not already in the list
        if (!document.querySelector(`.disc-card[data-post-id="${postId}"]`)) {
          addLocalPost(
            p.title || '',
            p.body || p.title || '',
            p.topic || 'general',
            p.isAnonymous === true,
            postId,
            p.likes || 0,
            p.commentCount || 0,
            p.username || null
          );
        }
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  currentTopic = localStorage.getItem('femcare-topic') || 'all';
  initReveal();
  initTips();
  loadPosts();
  startPostsListener();
  loadResources();
  loadStories();
  loadStats();
});

function updateLoadMoreBtn(show) {
  let btn = document.getElementById('loadMoreBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'loadMoreBtn';
    btn.className = 'cta-ghost';
    btn.style.cssText = 'display:block;margin:24px auto;';
    btn.textContent = 'Load more discussions';
    btn.onclick = () => loadPosts(true);
    const list = document.getElementById('discList');
    if (list) list.parentNode.insertBefore(btn, list.nextSibling);
  }
  btn.style.display = show ? 'block' : 'none';
}

window.onDiscussionSearchInput = function() {
  clearTimeout(discussionSearchTimeout);
  discussionSearchTimeout = setTimeout(() => {
    discussionSearchQuery = document.getElementById('discussionSearch')?.value?.trim() || '';
    loadPosts();
  }, 300);
};

function renderPosts(posts, container = document.getElementById("discList")){
  
  if (!posts.length) { list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:32px;">No discussions yet. Be the first to ask!</p>'; return; }
  list.innerHTML = posts.map(p => `
    <div class="disc-card" data-tag="${p.topic}">
      <div class="dc-meta">
        <div class="dc-avatar">${topicEmoji(p.topic)}</div>
        <span class="dc-author">${p.is_anon || !p.username ? 'Anonymous' : p.username}</span>
        ${p.is_anon ? '<span class="anon-pill">ANON</span>' : ''}
        <span class="dc-time">${timeAgo(p.created_at)}</span>
      </div>
      <span class="topic-chip chip-${p.topic}">${topicLabel(p.topic)}</span>
      <div class="dc-title">${esc(p.title)}</div>
      <div class="dc-preview">${esc(p.body).slice(0,160)}${p.body.length>160?'…':''}</div>
      <div class="dc-footer">
        <button class="dc-action" onclick="likePost('${p.id}',this)">♡ <span>${p.likes}</span></button>
        <span class="dc-action">💬 ${p.reply_count||0} replies</span>
        <button class="dc-action" onclick="savePost('${p.id}',this)">🔖 Save</button>
      </div>
    </div>
  `).join('');
}

function renderSamplePosts() {
  const samples = [
    {topic:'period',anon:true,title:'My first period arrived at school — I was completely unprepared 😰',body:"I was in the middle of class and had no idea what to do. Has anyone else gone through this?",likes:17,replies:9,time:'1 hr ago'},
    {topic:'health',anon:false,user:'Priya_wellness',title:'Are really painful cramps normal, or should I see a doctor?',body:"Mine last about two days. My mum says it's normal but I just want to be sure…",likes:31,replies:18,time:'4 hr ago'},
    {topic:'mood',anon:false,user:'aarushi_m',title:'I feel really sad and irritable right before my period — is this PMS?',body:"Nobody told me periods affect your mood too. Would love to hear how others manage this.",likes:44,replies:26,time:'Yesterday'},
    {topic:'hygiene',anon:true,title:'Pads vs tampons vs menstrual cups — which is best to start with?',body:"I've only used pads and want to start swimming again. I'm 13 and not sure where to begin.",likes:29,replies:21,time:'2 days ago'},
  ];
  return samples.map(p => `
    <div class="disc-card" data-tag="${p.topic}">
      <div class="dc-meta">
        <div class="dc-avatar">${topicEmoji(p.topic)}</div>
        <span class="dc-author">${p.anon ? 'Anonymous' : p.user}</span>
        ${p.anon ? '<span class="anon-pill">ANON</span>' : ''}
        <span class="dc-time">${p.time}</span>
      </div>
      <span class="topic-chip chip-${p.topic}">${topicLabel(p.topic)}</span>
      <div class="dc-title">${p.title}</div>
      <div class="dc-preview">${p.body}</div>
      <div class="dc-footer">
        <button class="dc-action" onclick="localLike(this)">♡ <span>${p.likes}</span></button>
        <span class="dc-action">💬 ${p.replies} replies</span>
        <button class="dc-action">🔖 Save</button>
      </div>
    </div>
  `).join('');
}

window.localLike = function(el) {
  const n = el.querySelector('span');
  n.textContent = +n.textContent + 1;
  el.style.color = 'var(--terra)';
}


window.filterTab = function(btn, tag) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentTopic = tag;
  try { localStorage.setItem('femcare-topic', tag); } catch (e) {}
  loadPosts();
}

window.submitQuickPost = async function() {
  const user = auth.currentUser;
  if (!user) { toast('Please sign in to post.', 'error'); openModal('auth'); return; }
  const title = document.getElementById('quickPost').value.trim();
  const topic = document.getElementById('quickTopic').value || 'general';
  const isAnonymous = document.getElementById('quickAnon').checked;
  if (!title || title.length < 5) { toast('Please write at least 5 characters.', 'error'); return; }
  let username = null;
  if (user && !isAnonymous) {
    const q = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
    q.forEach(d => { username = d.data().username || 'User'; });
  }
  try {
    await addDoc(collection(db, "posts"), {
      title,
      body: title,
      topic,
      isAnonymous,
      userId: user ? user.uid : null,
      username: isAnonymous ? null : (username || (user ? 'User' : null)),
      likes: 0,
      commentCount: 0,
      createdAt: serverTimestamp()
    });
    document.getElementById('quickPost').value = '';
    document.getElementById('quickAnon').checked = false;
    document.getElementById('quickTopic').value = '';
    loadPosts();
    toast('Your post is live! 🌸', 'success');
  } catch(e) {
    console.error(e);
    addLocalPost(title, title, topic, isAnonymous, null, 0);
    toast('Posted locally (offline).', '');
  }
}

window.submitPost = async function() {
  const title   = document.getElementById('postTitle').value.trim();
  const body    = document.getElementById('postBody').value.trim();
  const topic   = document.getElementById('postTopic').value || 'general';
  const isAnonymous = document.getElementById('postAnon').checked;
  if (!title || title.length < 5) { showModalError('postError','Please enter a title (min 5 chars).'); return; }
  if (!body  || body.length  < 10){ showModalError('postError','Please add more detail (min 10 chars).'); return; }
  const user = auth.currentUser;
  let username = null;
  if (user && !isAnonymous) {
    const q = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));
    q.forEach(d => { username = d.data().username || 'User'; });
  }
  try {
    await addDoc(collection(db, "posts"), {
      title,
      body,
      topic,
      isAnonymous,
      userId: user ? user.uid : null,
      username: isAnonymous ? null : (username || (user ? 'User' : null)),
      likes: 0,
      commentCount: 0,
      createdAt: serverTimestamp()
    });
    document.getElementById('postTitle').value = '';
    document.getElementById('postBody').value = '';
    document.getElementById('postTopic').value = '';
    document.getElementById('postAnon').checked = false;
    closeModal('post');
    loadPosts();
    toast('Your question is posted! 🌸', 'success');
  } catch (e) {
    console.error(e);
    addLocalPost(title, body, topic, isAnonymous, null, 0);
    closeModal('post');
    toast('Posted locally (offline).', '');
  }
}

function addLocalPost(title, body, topic, isAnonymous, postId, likes = 0, commentCount = 0, usernameFromPost = null){
  const list = document.getElementById('discList');
  if (!list) return;
  const safeId = (postId || '').replace(/'/g, "\\'");
  const authorName = isAnonymous ? 'Anonymous' : (usernameFromPost || 'You');
  const card = document.createElement('div');
  card.className = 'disc-card';
  card.dataset.tag = topic;
  if (postId) card.setAttribute('data-post-id', postId);
  const expandableHtml = postId ? `
    <div class="disc-card-comments" style="display:none;">
      <div class="disc-card-comments-inner">
        <p class="disc-card-comments-head">💬 Replies — read below and add yours</p>
        <div class="disc-card-comments-list"></div>
        <div class="disc-card-comments-form">
          <label class="anon-toggle"><input type="checkbox" class="comment-anon-inline"/> Post anonymously</label>
          <textarea class="comment-text-inline" placeholder="Write a reply… (Shift+Enter for new line)" rows="2" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitCommentInline('${safeId}')}"></textarea>
          <button type="button" class="comment-submit-inline" onclick="submitCommentInline('${safeId}')">Reply</button>
        </div>
      </div>
    </div>` : '';
  card.innerHTML = `
    <div class="dc-meta">
      <div class="dc-avatar">${topicEmoji(topic)}</div>
      <span class="dc-author">${esc(authorName)}</span>
      ${isAnonymous ? '<span class="anon-pill">ANON</span>' : ''}
      <span class="dc-time">Just now</span>
    </div>
    <span class="topic-chip chip-${topic}">${topicLabel(topic)}</span>
    <div class="dc-title" style="cursor:pointer;" onclick="openThreadModal('${safeId}')">${esc(title)}</div>
    <div class="dc-preview">${esc((body || title).slice(0, 160))}${(body || title).length > 160 ? '…' : ''}</div>
    <div class="dc-footer">
      <button class="dc-action" onclick="likePost('${safeId}')">♡ <span>${likes}</span></button>
      <button type="button" class="dc-action dc-action-comment" onclick="togglePostComments('${safeId}')">💬 <span class="comment-count">${commentCount}</span> replies</button>
      <button class="dc-action" onclick="savePost('${safeId}')">🔖 Save</button>
    </div>
    ${expandableHtml}`;
  if (list.firstChild) list.insertBefore(card, list.firstChild);
  else list.appendChild(card);
}

// ── COMMENTS (expand inside post card, scroll in card) ───
window.togglePostComments = async function(postId) {
  const card = document.querySelector(`.disc-card[data-post-id="${postId}"]`);
  if (!card) return;
  const section = card.querySelector('.disc-card-comments');
  const btn = card.querySelector('.dc-action-comment');
  if (!section || !btn) return;
  const countEl = btn.querySelector('.comment-count');
  const count = countEl ? countEl.textContent : '0';
  const isOpen = section.style.display === 'block';
  if (isOpen) {
    section.style.display = 'none';
    btn.innerHTML = '💬 <span class="comment-count">' + count + '</span> replies';
  } else {
    section.style.display = 'block';
    btn.innerHTML = '▼ <span class="comment-count">' + count + '</span> replies — hide';
    await loadRepliesIntoCard(postId);
  }
};

async function loadRepliesIntoCard(postId) {

  const card = document.querySelector(`.disc-card[data-post-id="${postId}"]`);
  if (!card) return;

  const listEl = card.querySelector('.disc-card-comments-list');
  if (!listEl) return;

  listEl.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  const q = query(
    collection(db,'posts',postId,'replies'),
    orderBy('createdAt','asc')
  );

  const snap = await getDocs(q);

  const replies = [];
  snap.forEach(d => replies.push({ id:d.id, ...d.data() }));

  buildReplyTree(postId,replies,listEl);

}


function buildReplyTree(postId,replies,container){

  const map = {};
  const roots = [];

  replies.forEach(r=>{
    r.children = [];
    map[r.id] = r;
  });

  replies.forEach(r=>{
    if(!r.parentReplyId){
      roots.push(r);
    } else if(map[r.parentReplyId]){
      map[r.parentReplyId].children.push(r);
    }
  });

  renderReplies(postId,roots,container,0);

}

function renderReplies(postId,replies,container,level){

  if(level===0) container.innerHTML = '';

  replies.forEach(r=>{

    const div=document.createElement('div');

    div.className='reply-item';
    div.style.marginLeft = (level*20) + 'px';

    div.innerHTML = `
  <div class="reply-meta">
    <span class="reply-author">${r.isAnonymous ? 'Anonymous' : esc(r.username || 'User')}</span>
    <span class="reply-time">${r.createdAt ? timeAgo(r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)) : 'Just now'}</span>
  </div>

  <div class="reply-text">${esc(r.text)}</div>

  <div class="reply-actions">
  <button class="reply-action" onclick="toggleNestedReplyForm('${r.id}')">↩ Reply</button>
</div>

<div class="nested-reply-form" id="nested-form-${r.id}" style="display:none;">
  <textarea class="comment-text-inline"
    placeholder="Write a reply..."
    rows="2"
    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitNestedReply('${postId}','${r.id}')}">
  </textarea>

  <label class="anon-toggle">
    <input type="checkbox" class="comment-anon-inline"/> Post anonymously
  </label>

  <button type="button"
    class="comment-submit-inline"
    onclick="submitNestedReply('${postId}','${r.id}')">
    Reply
  </button>
</div>

<div class="reply-children" id="children-${r.id}"></div>

  <div class="reply-children" id="children-${r.id}"></div>
`;
div.addEventListener("click",(e)=>{

  if(e.target.classList.contains("reply-meta")){
    div.classList.toggle("reply-collapsed");
  }

});

    container.appendChild(div);

    const childContainer = div.querySelector(`#children-${r.id}`);

if(r.children.length > 0){
  renderReplies(postId,r.children,childContainer,level+1);
}

  });

}


window.toggleNestedReplyForm = function(replyId){

  const form = document.getElementById(`nested-form-${replyId}`);
  if(!form) return;

  form.style.display =
    form.style.display === "none" ? "block" : "none";

}


window.submitNestedReply = async function(postId, parentReplyId) {
  const user = auth.currentUser;
  if (!user) { toast('Please sign in to reply.', 'error'); openModal('auth'); return; }

  const form = document.getElementById(`nested-form-${parentReplyId}`);
  if (!form) return;

  const textarea  = form.querySelector('.comment-text-inline');
  const anonBox   = form.querySelector('.comment-anon-inline');
  const text      = textarea ? textarea.value.trim() : '';
  const isAnonymous = anonBox ? anonBox.checked : false;

  if (!text || text.length < 2) { toast('Reply is too short.', 'error'); return; }

  let username = null;
  if (!isAnonymous) {
    const q = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
    q.forEach(d => { username = d.data().username || 'User'; });
  }

  try {
    await addDoc(collection(db, 'posts', postId, 'replies'), {
      text,
      userId: user.uid,
      username: isAnonymous ? null : (username || 'User'),
      isAnonymous,
      likes: 0,
      parentReplyId: parentReplyId ?? null,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });

    if (textarea) textarea.value = '';
    if (anonBox) anonBox.checked = false;
    form.style.display = 'none';
    loadRepliesIntoCard(postId);

    // Create container if it doesn't exist yet
    let nestedContainer = document.getElementById(`nested-replies-${parentReplyId}`);
    if (!nestedContainer) {
      nestedContainer = document.createElement('div');
      nestedContainer.className = 'nested-replies-list';
      nestedContainer.id = `nested-replies-${parentReplyId}`;
      form.parentNode.appendChild(nestedContainer);
    }

    toast('Reply posted! 💬', 'success');

await loadRepliesIntoCard(postId);

if(currentThreadPostId === postId){
  await loadThreadModalReplies(postId);
}
  } catch(e) {
    console.error(e);
    toast('Could not post reply.', 'error');
  }
}

window.submitCommentInline = async function(postId) {
  const user = auth.currentUser;
  if (!user) { toast('Please sign in to reply.', 'error'); openModal('auth'); return; }

  const card = document.querySelector(`.disc-card[data-post-id="${postId}"]`);
  if (!card) return;

  const textarea = card.querySelector('.comment-text-inline');
  const anonBox  = card.querySelector('.comment-anon-inline');
  const text = textarea ? textarea.value.trim() : '';
  const isAnonymous = anonBox ? anonBox.checked : false;

  if (!text || text.length < 2) { toast('Reply is too short.', 'error'); return; }

  let username = null;
  if (!isAnonymous) {
    const q = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
    q.forEach(d => { username = d.data().username || 'User'; });
  }

  try {
    await addDoc(collection(db, 'posts', postId, 'replies'), {
  text,
  userId: user.uid,
  username: isAnonymous ? null : (username || 'User'),
  isAnonymous,
  likes: 0,
  dislikes: 0,
  parentReplyId: null,
  createdAt: serverTimestamp()
});

    await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });

    if (textarea) textarea.value = '';
    if (anonBox) anonBox.checked = false;

    // Update the reply count in the card footer
    const countEl = card.querySelector('.comment-count');
    if (countEl) countEl.textContent = Number(countEl.textContent) + 1;

    toast('Reply posted! 💬', 'success');
    await loadRepliesIntoCard(postId);
  } catch(e) {
    console.error(e);
    toast('Could not post reply.', 'error');
  }
}

// ── RESOURCES (Firestore collection: resources) ─────────
// Fields: title, summary, content, category, read_mins, icon, tags
async function loadResources(category = '', search = '') {
  const grid = document.getElementById('resourceGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading resources…</div>';
  try {
    const snap = await getDocs(collection(db, 'resources'));
    const resources = [];
    snap.forEach(d => {
      const r = d.data();
      resources.push({
        id: d.id,
        title: r.title || '',
        summary: r.summary || '',
        content: r.content || '',
        category: r.category || 'general',
        read_mins: r.read_mins || 5,
        icon: r.icon || '📖',
        tags: r.tags || ''
      });
    });
    let filtered = resources;
    if (category) filtered = filtered.filter(r => r.category === category);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(r =>
        (r.title || '').toLowerCase().includes(s) ||
        (r.summary || '').toLowerCase().includes(s) ||
        (r.tags || '').toLowerCase().includes(s)
      );
    }
    if (filtered.length === 0) {
      grid.innerHTML = '<p style="color:var(--muted);padding:32px;grid-column:1/-1;text-align:center;">No resources found. Add one using the button above.</p>';
      updateCatCountsFromResources(resources);
      return;
    }
    renderResourceGrid(filtered);
    updateCatCountsFromResources(resources);
  } catch (e) {
    console.error(e);
    grid.innerHTML = '<p style="color:var(--muted);padding:32px;grid-column:1/-1;text-align:center;">Could not load resources. Check your connection.</p>';
  }
}

function updateCatCountsFromResources(resources) {
  const categories = ['period', 'health', 'mood', 'hygiene', 'nutrition', 'general'];
  const counts = {};
  categories.forEach(c => { counts[c] = 0; });
  resources.forEach(r => {
    if (r.category && counts[r.category] !== undefined) counts[r.category]++;
  });
  let total = 0;
  categories.forEach(c => {
    total += counts[c];
    const el = document.getElementById('catCount' + capitalize(c));
    if (el) el.textContent = counts[c];
  });
  const allEl = document.getElementById('catCountAll');
  if (allEl) allEl.textContent = total;
}

function renderResourceGrid(resources) {
  const grid = document.getElementById('resourceGrid');
  if (!resources.length) {
    grid.innerHTML = '<p style="color:var(--muted);padding:32px;grid-column:1/-1;">No resources found. Try a different search or category.</p>';
    return;
  }
  grid.innerHTML = resources.map(r => `
    <div class="resource-card resource-card-wrap">
      <div class="resource-card-click" onclick="showResourceDetail('${r.id}')">
        <div class="rc-icon">${r.icon}</div>
        <div class="rc-cat">${r.category.toUpperCase()}</div>
        <div class="rc-title">${esc(r.title)}</div>
        <div class="rc-summary">${esc(r.summary)}</div>
        <div class="rc-footer">
          <span class="rc-time">⏱ ${r.read_mins} min read</span>
          <div class="rc-tags">${(r.tags||'').split(',').filter(Boolean).slice(0,2).map(t=>`<span class="rc-tag">${t.trim()}</span>`).join('')}</div>
        </div>
      </div>
      <button type="button" class="rc-delete" onclick="event.stopPropagation(); deleteResource('${r.id}')" title="Delete resource">×</button>
    </div>
  `).join('');
}


window.filterResources = function(btn, category) {
  document.querySelectorAll('.resource-cats button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  resourceCategory = category;
  loadResources(category, document.getElementById('resourceSearch').value.trim());
}

window.searchResources = function() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadResources(resourceCategory, document.getElementById('resourceSearch').value.trim());
  }, 350);
}

window.showResourceDetail = async function(id) {
  showPage('resource-detail');
  const content = document.getElementById('resourceDetailContent');
  content.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  try {
    const resSnap = await getDoc(doc(db, 'resources', id));
    if (!resSnap.exists()) {
      content.innerHTML = '<p style="color:var(--muted);">Resource not found.</p>';
      return;
    }
    const r = { id: resSnap.id, ...resSnap.data() };
    const resource = {
      id: r.id,
      title: r.title || '',
      summary: r.summary || '',
      content: r.content || '',
      category: r.category || 'general',
      read_mins: r.read_mins || 5,
      icon: r.icon || '📖',
      tags: r.tags || ''
    };
    const allSnap = await getDocs(collection(db, 'resources'));
    const related = [];
    allSnap.forEach(d => {
      if (d.id === id) return;
      const data = d.data();
      if (data.category === resource.category)
        related.push({ id: d.id, title: data.title, summary: data.summary, icon: data.icon, read_mins: data.read_mins || 5 });
    });
    renderResourceDetail(resource, related.slice(0, 3));
  } catch (e) {
    console.error(e);
    content.innerHTML = '<p style="color:var(--muted);">Could not load resource.</p>';
  }
}

window.deleteResource = async function(id) {
  if (!confirm('Delete this resource? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'resources', id));
    toast('Resource deleted.', '');
    loadResources(resourceCategory, document.getElementById('resourceSearch')?.value?.trim() || '');
    const content = document.getElementById('resourceDetailContent');
    if (content && content.closest('.page.active')) showPage('resources');
  } catch (e) {
    console.error(e);
    toast('Could not delete resource.', 'error');
  }
};

function renderResourceDetail(r, related) {
  const bodyHtml = (r.content || '')
    .split('\n\n')
    .map(para => {
      if (para.startsWith('**') && para.endsWith('**')) return `<h3 style="font-family:Lora,serif;font-size:1.1rem;color:var(--stone);margin:24px 0 8px;">${para.replace(/\*\*/g,'')}</h3>`;
      return '<p>' + para.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>') + '</p>';
    }).join('');

  const relatedHtml = related && related.length ? `
    <hr class="rd-divider"/>
    <div class="rd-related">
      <h3>Related Resources</h3>
      <div class="rd-related-grid">
        ${related.map(r2 => `
          <div class="resource-card" onclick="showResourceDetail('${r2.id}')">
            <div class="rc-icon">${r2.icon}</div>
            <div class="rc-title">${esc(r2.title)}</div>
            <div class="rc-summary">${esc(r2.summary)}</div>
            <div class="rc-footer"><span class="rc-time">⏱ ${r2.read_mins} min</span></div>
          </div>`).join('')}
      </div>
    </div>` : '';

  document.getElementById('resourceDetailContent').innerHTML = `
    <div class="rd-icon">${r.icon}</div>
    <div class="rd-cat">${r.category.toUpperCase()}</div>
    <div class="rd-title">${esc(r.title)}</div>
    <div class="rd-meta">
      <span>⏱ ${r.read_mins} min read</span>
      ${r.tags ? r.tags.split(',').filter(Boolean).map(t=>`<span class="rc-tag" style="background:var(--sand2);padding:4px 10px;border-radius:8px;font-size:.73rem;">${t.trim()}</span>`).join('') : ''}
    </div>
    <div class="rd-body">${bodyHtml}</div>
    <div class="rd-actions"><button type="button" class="btn-delete-resource" onclick="deleteResource('${r.id}'); showPage('resources');">Delete resource</button></div>
    ${relatedHtml}
  `;
}

window.submitResource = async function() {
  const title = document.getElementById('resAddTitle')?.value?.trim();
  const summary = document.getElementById('resAddSummary')?.value?.trim();
  const content = document.getElementById('resAddContent')?.value?.trim();
  const category = document.getElementById('resAddCategory')?.value || 'general';
  const readMins = parseInt(document.getElementById('resAddMins')?.value, 10) || 5;
  const icon = document.getElementById('resAddIcon')?.value?.trim() || '📖';
  const tags = document.getElementById('resAddTags')?.value?.trim() || '';
  if (!title || title.length < 2) { toast('Enter a title.', 'error'); return; }
  if (!summary || summary.length < 5) { toast('Enter a short summary.', 'error'); return; }
  try {
    await addDoc(collection(db, 'resources'), {
      title,
      summary,
      content: content || summary,
      category,
      read_mins: readMins,
      icon,
      tags
    });
    closeModal('resource-add');
    document.getElementById('resAddTitle').value = '';
    document.getElementById('resAddSummary').value = '';
    document.getElementById('resAddContent').value = '';
    document.getElementById('resAddCategory').value = 'general';
    document.getElementById('resAddMins').value = '5';
    document.getElementById('resAddIcon').value = '📖';
    document.getElementById('resAddTags').value = '';
    loadResources(resourceCategory, document.getElementById('resourceSearch')?.value?.trim() || '');
    toast('Resource added.', 'success');
  } catch (e) {
    console.error(e);
    toast('Could not add resource.', 'error');
  }
};

// ── STORIES (Firestore collection: stories) ─────────────
// Fields: title, body, author_age?, isAnonymous, userId?, username?, icon?, createdAt
async function loadStories() {
  const grid = document.getElementById('storiesGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading stories…</div>';
  try {
    const snap = await getDocs(collection(db, 'stories'));
    const stories = [];
    snap.forEach(d => {
      const s = d.data();
      stories.push({
        id: d.id,
        title: s.title || '',
        body: s.body || '',
        author_age: s.author_age || '',
        is_anon: s.isAnonymous === true,
        username: s.username || null,
        icon: s.icon || '✍️',
        createdAt: s.createdAt ? (s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt)) : new Date()
      });
    });
    stories.sort((a, b) => b.createdAt - a.createdAt);
    if (stories.length === 0) {
      renderSampleStories();
      return;
    }
    renderStories(stories);
  } catch (e) {
    console.error(e);
    renderSampleStories();
  }
}

function renderStories(stories) {
  const grid = document.getElementById('storiesGrid');
  const addCard = `
    <div class="story-card story-add" onclick="openModal('story')">
      <div class="story-icon">✍️</div>
      <div class="story-title">Share your story</div>
      <div class="story-excerpt">Your experience might be exactly what someone else needs to hear.</div>
      <div class="story-by" style="color:var(--teal);">→ Add your story</div>
    </div>`;
  if (!stories.length) { grid.innerHTML = addCard; return; }
  grid.innerHTML = stories.map(s => `
    <div class="story-card">
      <div class="story-icon">${s.icon || '✍️'}</div>
      <div class="story-title">${esc(s.title)}</div>
      <div class="story-excerpt">${esc(s.body).slice(0,180)}${s.body.length>180?'…':''}</div>
      <div class="story-by">— ${s.is_anon||!s.username ? 'Anonymous' : esc(s.username)}${s.author_age ? ', ' + esc(s.author_age) : ''}</div>
    </div>`).join('') + addCard;
}

function renderSampleStories() {
  const samples = [
    {icon:'💌',title:'I thought something was wrong with me',body:'My first period came with no warning. My older sister sat with me and explained everything calmly. That moment changed how I saw my body.',by:'Anonymous, age 13'},
    {icon:'🏃‍♀️',title:'Sports and periods — finding balance',body:"I play volleyball and dreaded period days. Then I learned that light movement can ease cramps. Now I don't skip practice anymore.",by:'Nandini, age 16'},
    {icon:'🤝',title:'My daughter asked — I was not ready',body:"When my 11-year-old came to me with questions, I realised I didn't have all the answers. This community helped both of us learn together.",by:'A parent, age 37'},
  ];
  document.getElementById('storiesGrid').innerHTML = samples.map(s => `
    <div class="story-card">
      <div class="story-icon">${s.icon}</div>
      <div class="story-title">${s.title}</div>
      <div class="story-excerpt">${s.body}</div>
      <div class="story-by">— ${s.by}</div>
    </div>`).join('') + `
    <div class="story-card story-add" onclick="openModal('story')">
      <div class="story-icon">✍️</div>
      <div class="story-title">Share your story</div>
      <div class="story-excerpt">Your experience might be exactly what someone else needs to hear.</div>
      <div class="story-by" style="color:var(--teal);">→ Add your story</div>
    </div>`;
}

window.submitStory = async function() {
  const title    = document.getElementById('storyTitle').value.trim();
  const body     = document.getElementById('storyBody').value.trim();
  const author_age = document.getElementById('storyAge').value.trim();
  const isAnonymous = document.getElementById('storyAnon').checked;
  if (!title || title.length < 5) { showModalError('storyError', 'Please enter a title (min 5 chars).'); return; }
  if (!body  || body.length  < 20){ showModalError('storyError', 'Please write at least 20 characters.'); return; }
  const user = auth.currentUser;
  let username = null;
  if (user && !isAnonymous) {
    const q = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
    q.forEach(d => { username = d.data().username || 'User'; });
  }
  try {
    await addDoc(collection(db, 'stories'), {
      title,
      body,
      author_age: author_age || null,
      isAnonymous,
      userId: user ? user.uid : null,
      username: isAnonymous ? null : (username || (user ? 'User' : null)),
      icon: '✍️',
      createdAt: serverTimestamp()
    });
    document.getElementById('storyTitle').value = '';
    document.getElementById('storyBody').value = '';
    document.getElementById('storyAge').value = '';
    document.getElementById('storyAnon').checked = true;
    closeModal('story');
    loadStories();
    toast('Story submitted! 🌸', 'success');
  } catch (e) {
    console.error(e);
    showModalError('storyError', 'Could not submit. Try again.');
  }
}

// ── MODALS ─────────────────────────────────────────────
window.openModal = function(id) { document.getElementById('modal-'+id).classList.add('open'); }
window.closeModal = function(id) { document.getElementById('modal-'+id).classList.remove('open'); }
window.openPostModalOrAuth = function() {
  if (!auth.currentUser) { toast('Please sign in to post.', 'error'); openModal('auth'); return; }
  openModal('post');
};
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));
function showModalError(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; }

// ── WELLNESS TIPS ──────────────────────────────────────
const tips = [
  { title: 'Stay warm', body: 'A <strong>warm compress</strong> on your lower abdomen can ease cramps within minutes.' },
  { title: 'Hydrate well', body: '<strong>Warm water or herbal tea</strong> reduces bloating and helps with discomfort.' },
  { title: 'Gentle movement', body: '<strong>Light yoga or a slow walk</strong> releases endorphins that reduce pain naturally.' },
  { title: 'Track your cycle', body: 'Knowing when your period is coming helps you feel <strong>prepared and in control</strong>.' },
  { title: "You're normal", body: '<strong>Irregular periods</strong> in the first 2 years are completely common.' },
  { title: 'Eat iron-rich foods', body: 'Lentils, spinach, and dates replenish <strong>iron lost during your period</strong>.' },
];
let tipIdx = 0;
function initTips() {
  const nav = document.getElementById('tipNav');
  tips.forEach((_,i) => {
    const d = document.createElement('div');
    d.className = 'tip-dot' + (i===0?' active':'');
    d.onclick = () => showTip(i);
    nav.appendChild(d);
  });
  showTip(0);
  setInterval(() => showTip((tipIdx+1) % tips.length), 5000);
}
function showTip(i) {
  tipIdx = i;
  const box = document.getElementById('tipBox');
  box.style.opacity = 0;
  setTimeout(() => { box.innerHTML = `<strong>${tips[i].title}:</strong> ${tips[i].body}`; box.style.opacity = 1; }, 200);
  document.querySelectorAll('.tip-dot').forEach((d,j) => d.classList.toggle('active', j===i));
}

// ── REVEAL ─────────────────────────────────────────────
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach((e,i) => {
      if (e.isIntersecting) { setTimeout(() => e.target.classList.add('in'), i*55); obs.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ── HELPERS ────────────────────────────────────────────
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function topicEmoji(t) { return {period:'🩸',health:'🌿',mood:'🧡',hygiene:'🧴',nutrition:'🥗',general:'💬'}[t]||'💬'; }
function topicLabel(t) { return {period:'Period 🩸',health:'Body Health 🌿',mood:'Emotions 🧡',hygiene:'Hygiene 🧴',nutrition:'Nutrition 🥗',general:'General 💬'}[t]||t; }
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return Math.floor(diff/60) + ' min ago';
  if (diff < 86400)return Math.floor(diff/3600) + ' hr ago';
  return Math.floor(diff/86400) + ' days ago';
}

// ── SAVED POSTS ────────────────────────────────────────
async function loadSavedPosts() {
  const user = auth.currentUser;
  if (!user) return;
  const q = query(collection(db, 'savedPosts'), where('userId', '==', user.uid));
  const snap = await getDocs(q);
  const list = document.getElementById('savedList');
  if (!list) return;
  list.innerHTML = '';
  for (const d of snap.docs) {
    const { postId } = d.data();
    if (!postId) continue;
    const postSnap = await getDoc(doc(db, 'posts', postId));
    if (postSnap.exists()) {
      const p = { id: postSnap.id, ...postSnap.data() };
      const title = p.title || '';
      const body = p.body || title;
      const topic = p.topic || 'general';
      const isAnonymous = p.isAnonymous === true;
      const commentCount = p.commentCount != null ? p.commentCount : 0;
      const savedCard = document.createElement('div');
      savedCard.className = 'disc-card';
      savedCard.dataset.postId = postId;
      const expandableHtml = `
        <div class="disc-card-comments" style="display:none;">
          <div class="disc-card-comments-inner">
            <p class="disc-card-comments-head">💬 Replies — read below and add yours</p>
            <div class="disc-card-comments-list"></div>
            <div class="disc-card-comments-form">
              <label class="anon-toggle"><input type="checkbox" class="comment-anon-inline"/> Post anonymously</label>
              <textarea class="comment-text-inline" placeholder="Write a reply…" rows="2"></textarea>
              <button type="button" class="comment-submit-inline" onclick="submitCommentInline('${postId}')">Reply</button>
            </div>
          </div>
        </div>`;
      savedCard.innerHTML = `
        <div class="dc-meta">
          <div class="dc-avatar">${topicEmoji(topic)}</div>
          <span class="dc-author">${isAnonymous ? 'Anonymous' : esc(p.username || 'User')}</span>
          ${isAnonymous ? '<span class="anon-pill">ANON</span>' : ''}
        </div>
        <span class="topic-chip chip-${topic}">${topicLabel(topic)}</span>
        <div class="dc-title">${esc(title)}</div>
        <div class="dc-preview">${esc(body.slice(0, 160))}${body.length > 160 ? '…' : ''}</div>
        <div class="dc-footer">
          <button class="dc-action" onclick="likePost('${postId}')">♡ <span>${p.likes || 0}</span></button>
          <button type="button" class="dc-action dc-action-comment" onclick="togglePostComments('${postId}')">💬 <span class="comment-count">${commentCount}</span> replies</button>
          <button class="dc-action" onclick="savePost('${postId}')">🔖 Saved</button>
        </div>
        ${expandableHtml}`;
      list.appendChild(savedCard);
    }
  }
  if (list.innerHTML === '') {
    list.innerHTML = '<p style="color:var(--muted);">No saved discussions yet.</p>';
  }
}

// ── PROFILE PAGE ────────────────────────────────────────
async function loadProfileData() {
  const cardEl = document.getElementById('profileCard');
  const statsEl = document.getElementById('profileStats');
  const actionsEl = document.getElementById('profileActions');
  if (!cardEl) return;
  const user = auth.currentUser;
  if (!user) {
    cardEl.innerHTML = `
      <div class="profile-guest">
        <div class="profile-avatar">👤</div>
        <h2>Your Profile</h2>
        <p class="profile-guest-text">Sign in to see your profile, your posts, and saved discussions.</p>
        <button class="cta-primary" onclick="openModal('auth')">Sign In</button>
      </div>`;
    if (statsEl) statsEl.innerHTML = '';
    if (actionsEl) actionsEl.innerHTML = '';
    return;
  }
  let username = 'User';
  let email = user.email || '';
  const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
  userSnap.forEach(d => {
    const data = d.data();
    username = data.username || username;
    if (data.email) email = data.email;
  });
  const postsSnap = await getDocs(query(collection(db, 'posts'), where('userId', '==', user.uid)));
  const savedSnap = await getDocs(query(collection(db, 'savedPosts'), where('userId', '==', user.uid)));
  const storiesSnap = await getDocs(query(collection(db, 'stories'), where('userId', '==', user.uid)));
  const myPostsCount = postsSnap.size;
  const savedCount = savedSnap.size;
  const myStoriesCount = storiesSnap.size;
  cardEl.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${(username || 'U').charAt(0).toUpperCase()}</div>
      <div class="profile-info">
        <h1 class="profile-name">${esc(username)}</h1>
        <p class="profile-email">${esc(email)}</p>
      </div>
    </div>`;
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="profile-stat"><strong>${myPostsCount}</strong><span>Discussions</span></div>
      <div class="profile-stat"><strong>${myStoriesCount}</strong><span>Stories</span></div>
      <div class="profile-stat"><strong>${savedCount}</strong><span>Saved</span></div>`;
  }
  if (actionsEl) {
    actionsEl.innerHTML = `
      <button class="cta-ghost" onclick="showPage('community')">Browse Discussions</button>
      <button class="cta-primary" onclick="logoutUser(); showPage('home'); toast('Signed out.');">Sign Out</button>`;
  }
}

// Like Button
window.likePost = async function(postId) {
  const user = auth.currentUser;
  if (!user) { toast('Please sign in to like.', 'error'); openModal('auth'); return; }

  const q = query(collection(db, 'likes'), where('postId', '==', postId), where('userId', '==', user.uid));
  const snap = await getDocs(q);
  const card = document.querySelector(`.disc-card[data-post-id="${postId}"]`);
  const btn = card ? card.querySelector(`.dc-footer button[onclick*="likePost('${postId}')"]`) : null;
  const span = btn ? btn.querySelector('span') : null;

  if (!snap.empty) {
    // Unlike
    await deleteDoc(snap.docs[0].ref);
    await updateDoc(doc(db, 'posts', postId), { likes: increment(-1) });
    if (span) span.textContent = Math.max(0, Number(span.textContent) - 1);
    if (btn) btn.style.color = '';
    toast('Unliked', '');
  } else {
    // Like
    await addDoc(collection(db, 'likes'), { postId, userId: user.uid });
    await updateDoc(doc(db, 'posts', postId), { likes: increment(1) });
    if (span) span.textContent = Number(span.textContent) + 1;
    if (btn) btn.style.color = 'var(--terra)';
    toast('Liked! ♡', 'success');
  }
}

window.openThreadModal = async function(postId) {
  currentThreadPostId = postId;

  // Get post data
  const postSnap = await getDoc(doc(db, 'posts', postId));
  if (!postSnap.exists()) return;
  const p = { id: postSnap.id, ...postSnap.data() };

  // Render post inside modal
  const postEl = document.getElementById('thread-modal-post');
  postEl.innerHTML = `
    <div class="dc-meta">
      <div class="dc-avatar">${topicEmoji(p.topic || 'general')}</div>
      <span class="dc-author">${p.isAnonymous ? 'Anonymous' : esc(p.username || 'User')}</span>
      ${p.isAnonymous ? '<span class="anon-pill">ANON</span>' : ''}
      <span class="dc-time">${p.createdAt ? timeAgo(p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt)) : ''}</span>
    </div>
    <span class="topic-chip chip-${p.topic || 'general'}">${topicLabel(p.topic || 'general')}</span>
    <div class="thread-modal-post-title">${esc(p.title || '')}</div>
    <div class="thread-modal-post-body">${esc(p.body || '')}</div>
    <div class="dc-footer" style="margin-bottom:8px;">
      <button class="dc-action" onclick="likePost('${postId}')">♡ <span>${p.likes || 0}</span></button>
      <button class="dc-action" onclick="savePost('${postId}')">🔖 Save</button>
    </div>
  `;

  // Load replies
  await loadThreadModalReplies(postId);

  // Clear reply form
  const textarea = document.getElementById('thread-modal-textarea');
  const anon = document.getElementById('thread-modal-anon');
  if (textarea) textarea.value = '';
  if (anon) anon.checked = false;

  openModal('thread');
}

async function loadThreadModalReplies(postId){

  const listEl = document.getElementById("thread-modal-replies-list");
  if(!listEl) return;

  listEl.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  const q = query(
    collection(db,'posts',postId,'replies'),
    orderBy('createdAt','asc')
  );

  const snap = await getDocs(q);

  const replies = [];
  snap.forEach(d=>{
    replies.push({
      id:d.id,
      ...d.data()
    });
  });

  buildReplyTree(postId,replies,listEl);

}
async function loadModalNestedReplies(postId, parentReplyId) {
  const container = document.getElementById(`modal-nested-replies-${parentReplyId}`);
  if (!container) return;

  const q = query(
    collection(db, 'posts', postId, 'replies'),
    where('parentReplyId', '==', parentReplyId),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocsFromServer(q);
  const nested = [];
  snap.forEach(d => nested.push({ id: d.id, ...d.data() }));

  if (nested.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = nested.map(r => `
    <div class="reply-item nested" data-reply-id="${r.id}">
      <div class="reply-meta">
        <span class="reply-author">${r.isAnonymous ? 'Anonymous' : esc(r.username || 'User')}</span>
        ${r.isAnonymous ? '<span class="anon-pill">ANON</span>' : ''}
        <span class="reply-time">${r.createdAt ? timeAgo(r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)) : 'Just now'}</span>
      </div>
      <div class="reply-text">${esc(r.text)}</div>
      <div class="reply-actions">
        <button class="reply-action" onclick="likeReply('${postId}','${r.id}',this)">♡ <span>${r.likes || 0}</span></button>
        <button class="reply-action" onclick="toggleModalNestedForm('${r.id}')">↩ Reply</button>
      </div>
      <div class="nested-reply-form" id="modal-nested-form-${r.id}" style="display:none;">
        <textarea class="comment-text-inline" placeholder="Write a reply…" rows="2" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitModalNestedReply('${postId}','${r.id}')}"></textarea>
        <label class="anon-toggle"><input type="checkbox" class="comment-anon-inline"/> Post anonymously</label>
        <button type="button" class="comment-submit-inline" onclick="submitModalNestedReply('${postId}','${r.id}')">Reply</button>
      </div>
    </div>
  `).join('');
}

window.toggleModalNestedForm = function(replyId) {
  const form = document.getElementById(`modal-nested-form-${replyId}`);
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

window.submitThreadModalReply = async function() {
  const user = auth.currentUser;
  if (!user) { toast('Please sign in to reply.', 'error'); openModal('auth'); return; }
  if (!currentThreadPostId) return;

  const textarea = document.getElementById('thread-modal-textarea');
  const anonBox  = document.getElementById('thread-modal-anon');
  const text = textarea ? textarea.value.trim() : '';
  const isAnonymous = anonBox ? anonBox.checked : false;

  if (!text || text.length < 2) { toast('Reply is too short.', 'error'); return; }

  let username = null;
  if (!isAnonymous) {
    const q = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
    q.forEach(d => { username = d.data().username || 'User'; });
  }

  try {
    await addDoc(collection(db, 'posts', currentThreadPostId, 'replies'), {
      text,
      userId: user.uid,
      username: isAnonymous ? null : (username || 'User'),
      isAnonymous,
      likes: 0,
      dislikes: 0,
      parentReplyId: null,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'posts', currentThreadPostId), { commentCount: increment(1) });

    if (textarea) textarea.value = '';
    if (anonBox) anonBox.checked = false;

    toast('Reply posted! 💬', 'success');
    
    setTimeout(async () => {
      await loadThreadModalReplies(currentThreadPostId);
    }, 1000);

  } catch(e) {
    console.error(e);
    toast('Could not post reply.', 'error');
  }
}

window.submitModalNestedReply = async function(postId, parentReplyId) {
  const user = auth.currentUser;
  if (!user) { toast('Please sign in to reply.', 'error'); openModal('auth'); return; }

  const form = document.getElementById(`modal-nested-form-${parentReplyId}`);
  if (!form) return;

  const textarea  = form.querySelector('.comment-text-inline');
  const anonBox   = form.querySelector('.comment-anon-inline');
  const text      = textarea ? textarea.value.trim() : '';
  const isAnonymous = anonBox ? anonBox.checked : false;

  if (!text || text.length < 2) { toast('Reply is too short.', 'error'); return; }

  let username = null;
  if (!isAnonymous) {
    const q = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
    q.forEach(d => { username = d.data().username || 'User'; });
  }

  try {
    await addDoc(collection(db, 'posts', postId, 'replies'), {
      text,
      userId: user.uid,
      username: isAnonymous ? null : (username || 'User'),
      isAnonymous,
      likes: 0,
      dislikes: 0,
      parentReplyId,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });

    if (textarea) textarea.value = '';
    if (anonBox) anonBox.checked = false;
    form.style.display = 'none';

    toast('Reply posted! 💬', 'success');
setTimeout(async () => {
  await loadModalNestedReplies(postId, parentReplyId);
}, 500);
  } catch(e) {
    console.error(e);
    toast('Could not post reply.', 'error');
  }
}
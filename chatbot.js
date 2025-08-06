const API_URL = "http://127.0.0.1:8000/chat"; // Use your FastAPI backend URL

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");

// Send user message to backend
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  appendMessage("user", msg);

  chatInput.value = "";
  appendTyping();
  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: localStorage.getItem("session_id") || "ism-"+Date.now(),
        query: msg,
        user_locale: "en_US" // or get from navigator
      })
    });
    const data = await resp.json();
    removeTyping();
    appendMessage("bot", data.response || "Sorry, I could not connect. Try again!");
  } catch (err) {
    removeTyping();
    appendMessage("bot", "There was a network error. Please try again.");
  }
});

function appendMessage(sender, text) {
  const msgEl = document.createElement("div");
  msgEl.className = `chat-message ${sender}`;
  msgEl.innerHTML = (sender === "bot" ? '<span class="avatar">🤖</span>' : "") +
    `<span>${text}</span>`;
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendTyping() {
  const typing = document.createElement("div");
  typing.className = "chat-message bot typing-indicator";
  typing.innerHTML = '<span class="avatar">🤖</span><span><em>typing...</em></span>';
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function removeTyping() {
  const indicators = document.querySelectorAll(".typing-indicator");
  indicators.forEach(el => el.remove());
}

// Quick actions for common scenarios
function quickMessage(text) {
  chatInput.value = text;
  chatInput.focus();
}

// Modal resource popups for campus info, events, crisis, etc.
function openResource(type) {
  let html = "";
  if (type === "counseling") {
    html = `<h2>IIT ISM Counseling</h2>
      <p><b>Location:</b> Counseling Cell, Main Building<br>
      <b>Email:</b> wellness@iitism.ac.in<br>
      <b>Phone:</b> 0326-223-5559<br>
      <b>Timings:</b> 10am - 5pm (Monday to Friday)</p>`;
  } else if (type === "emergency") {
    html = `<h2>Emergency Help</h2>
      <p>If you or a friend is in crisis, call:<br>
      <b>Campus Helpline:</b> 1800-123-456 (24x7)<br>
      <b>Samaritans India:</b> 9152987821<br>
      <b>Dean SW Office:</b> dsw@iitism.ac.in / extension 4004</p>`;
  } else if (type === "events") {
    html = `<h2>Wellness Events</h2>
      <p><b>Weekly Yoga (Tuesdays 5pm)</b><br>
      <b>Peer Support Circle (Fridays 6pm, E-Block)</b><br>
      <b>Stress Management Workshop (Check your email)</b></p>`;
  } else if (type === "faq") {
    html = `<h2>FAQs</h2>
      <ul>
        <li><b>Is my chat private?</b> Yes, all conversations are confidential for your safety.</li>
        <li><b>Can I access resources at night?</b> Yes, the bot is 24x7 and help info is always available.</li>
      </ul>`;
  } else if (type === "privacy") {
    html = `<h2>Privacy & Safety</h2>
      <p>Your data is never shared. You can chat anonymously or ask the bot to delete your data at any time.</p>`;
  }
  modalBody.innerHTML = html;
  modal.style.display = "flex";
}
function closeModal() {
  modal.style.display = "none";
}
window.openResource = openResource;
window.closeModal = closeModal;
window.quickMessage = quickMessage;

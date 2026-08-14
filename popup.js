document.addEventListener('DOMContentLoaded', async () => {
  // Lấy dữ liệu cũ ra nạp lên màn hình ngay khi vừa click mở icon Add-on
  chrome.storage.local.get(['savedUsername', 'currentDeletedCount'], (res) => {
    if (res.savedUsername) document.getElementById('usernameInput').value = res.savedUsername;
    if (res.currentDeletedCount !== undefined) {
      document.getElementById('counter').innerText = res.currentDeletedCount;
    }
  });

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url.includes("threads.com")) {
    // Hỏi trạng thái ngầm từ Content Script
    chrome.tabs.sendMessage(tab.id, { action: "checkStatus" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.isRunning) {
        toggleUi(true);
        document.getElementById('counter').innerText = response.currentCount;
        document.getElementById('status').innerText = "⚙️ Mắt thần đang liên kết chạy ngầm liên tục...";
      }
    });
  }
});

document.getElementById('startBtn').addEventListener('click', async () => {
  let myUsername = document.getElementById('usernameInput').value.trim();
  if (!myUsername) {
    document.getElementById('status').innerText = "⚠️ Hãy nhập Username!";
    return;
  }

  // Khởi tạo lượt quét mới sạch sẽ
  chrome.storage.local.set({ savedUsername: myUsername, currentDeletedCount: 0 });
  document.getElementById('counter').innerText = "0";

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url.includes("threads.com")) {
    document.getElementById('status').innerText = "❌ Vui lòng mở trang Threads.com!";
    return;
  }

  toggleUi(true);
  document.getElementById('status').innerText = "🔍 Đang tự động zoom về 50%...";
  chrome.tabs.setZoom(tab.id, 0.5);

  // Phát lệnh đánh thức Content Script chạy ngầm
  chrome.tabs.sendMessage(tab.id, { action: "startScan", username: myUsername });
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "stopScan" });
    chrome.tabs.setZoom(tab.id, 1.0);
  }
  toggleUi(false);
  document.getElementById('status').innerText = "🛑 Đã dừng và khôi phục màn hình!";
});

// Luôn lắng nghe lệnh nhảy số lượng liên tục từ trang web đẩy về
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateCounter") {
    let counterEl = document.getElementById('counter');
    if (counterEl) counterEl.innerText = request.count;
  } else if (request.action === "finished") {
    toggleUi(false);
    document.getElementById('status').innerText = "✅ Đã sạch bóng bình luận lỗi!";
  }
});

function toggleUi(isRunning) {
  document.getElementById('startBtn').style.display = isRunning ? 'none' : 'block';
  document.getElementById('userGroup').style.display = isRunning ? 'none' : 'block';
  document.getElementById('stopBtn').style.display = isRunning ? 'block' : 'none';
  document.getElementById('counterContainer').style.display = isRunning ? 'block' : 'none';
}

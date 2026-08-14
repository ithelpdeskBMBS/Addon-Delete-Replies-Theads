window.isThreadsCleanerRunning = false;
window.myThreadsUsername = "";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startScan") {
    window.isThreadsCleanerRunning = true;
    window.myThreadsUsername = request.username;
    console.log(`🧠 [Super Speed Mode] Kích hoạt luồng kết liễu siêu tốc cho: @${window.myThreadsUsername}`);
    runInstantCleaner();
    sendResponse({ success: true });
  } else if (request.action === "stopScan") {
    window.isThreadsCleanerRunning = false;
    console.log("🛑 [Content Script] Đã dừng tiến trình dọn dẹp.");
    sendResponse({ success: true });
  } else if (request.action === "getStatus") {
    sendResponse({ isRunning: window.isThreadsCleanerRunning });
  }
});

async function runInstantCleaner() {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  
  // Đọc số lượng đếm cũ từ Storage ra chạy tiếp
  let localDeletedCount = 0;
  let syncRes = await new Promise(r => chrome.storage.local.get(['currentDeletedCount'], r));
  if (syncRes && syncRes.currentDeletedCount) {
    localDeletedCount = parseInt(syncRes.currentDeletedCount) || 0;
  }

  const statusListener = (msg, sender, sendResponse) => {
    if (msg.action === "checkStatus") {
      sendResponse({ isRunning: window.isThreadsCleanerRunning, currentCount: localDeletedCount });
    } else if (msg.action === "forceStop") {
      window.isThreadsCleanerRunning = false;
    }
  };
  chrome.runtime.onMessage.addListener(statusListener);

  let emptyScrollCount = 0;

  while (window.isThreadsCleanerRunning) {
    // Quét toàn bộ khối timeline lớn dựa trên cấu trúc bạn gửi
    let timelineBlocks = Array.from(document.querySelectorAll('div[data-pagelet*="threads_profile_posts_timeline_"]'));
    let validItemsOnScreen = [];

    for (let block of timelineBlocks) {
      let rawHtmlCode = block.outerHTML || "";
      if (rawHtmlCode.includes("Replying to")) continue; 

      let hasGhostError = rawHtmlCode.includes("Reply to unavailable post") || rawHtmlCode.includes("Reply to unavailable ghost post") || rawHtmlCode.includes("Reply to unavailable");

      if (hasGhostError) {
        let myPostLinkElement = block.querySelector(`a[href*="/@${window.myThreadsUsername}/post/"]`);

        if (myPostLinkElement) {
          let myOwnSection = myPostLinkElement.closest('div.x1a2a7pz.x1n2onr6, div[style*="position: relative"], article');
          if (myOwnSection) {
            let menuBtn = myOwnSection.querySelector('div[aria-haspopup="menu"], div[role="button"][aria-label*="Thêm"], div[role="button"][aria-expanded]');
            if (menuBtn) {
              validItemsOnScreen.push({ btn: menuBtn, elementToWatch: myOwnSection, blockContainer: block });
            }
          }
        }
      }
    }

    // CUỘN TRANG: Chỉ cuộn chuột khi màn hình hiện tại hết sạch bài lỗi thỏa mãn bộ lọc Post ID
    if (validItemsOnScreen.length === 0) {
      if (!window.isThreadsCleanerRunning) break;
      let oldHeight = document.body.scrollHeight;
      
      window.scrollBy(0, 500);
      console.log(`⏳ Màn hình sạch, đang cuộn bước đệm lần thứ ${emptyScrollCount + 1}...`);
      await delay(1800); 

      let anyPostLeft = document.querySelector(`a[href*="/@${window.myThreadsUsername}/post/"]`);
      if (!anyPostLeft) {
        emptyScrollCount++;
      } else {
        emptyScrollCount = 0; 
      }

      if (emptyScrollCount >= 5) {
        console.log("✅ Đã dọn dẹp sạch toàn bộ trang cá nhân!");
        window.isThreadsCleanerRunning = false;
        chrome.runtime.sendMessage({ action: "finished" });
        break;
      }
      continue;
    }

    emptyScrollCount = 0;
    
    // 🌟 CHIẾN LƯỢC TỐC ĐỘ: Luôn chọn đúng mục trên cùng màn hình (mục số 0) để xóa từ trên xuống, giúp sụt layout mượt nhất
    let firstItem = validItemsOnScreen[0];

    if (firstItem && window.isThreadsCleanerRunning) {
      try {
        firstItem.btn.scrollIntoView({ block: 'center' });
        await delay(200); // Rút ngắn tối đa thời gian chờ định vị

        firstItem.btn.click(); // Bước 1: Mở menu 3 chấm

        let deleteOption = null;
        let menuCheckCount = 0;
        while (window.isThreadsCleanerRunning && menuCheckCount < 40) { 
          let menuItems = Array.from(document.querySelectorAll('.xhci195'));
          deleteOption = menuItems.find(el => {
            let text = (el.innerText || "").trim().toLowerCase();
            return (text === "delete" || text.includes("delete")) && el.closest('div[role="menuitem"]');
          });
          if (deleteOption) break; 
          await delay(40); // Nhịp check siêu tốc 40ms
          menuCheckCount++;
        }

        if (deleteOption && window.isThreadsCleanerRunning) {
          deleteOption.click(); // Bước 2: Chọn Delete lần 1
          
          let confirmBtn = null;
          let confirmCheckCount = 0;
          while (window.isThreadsCleanerRunning && confirmCheckCount < 40) {
            let dialogTitle = document.querySelector('h2.x1lliihq');
            if (dialogTitle && dialogTitle.innerText.includes("Delete post?")) {
              let dialogContainer = dialogTitle.closest('div[role="status"], div.x1iorvi4, div.x1ja2u2z');
              if (dialogContainer) {
                let spansInDialog = Array.from(dialogContainer.querySelectorAll('span.xhci195'));
                let targetSpan = spansInDialog.find(span => span.innerText.includes("Delete"));
                if (targetSpan) {
                  confirmBtn = targetSpan.closest('div[role="button"]');
                  if (confirmBtn) break;
                }
              }
            }
            await delay(40);
            confirmCheckCount++;
          }

          if (confirmBtn && window.isThreadsCleanerRunning) {
            confirmBtn.click(); // Bước 3: Xác nhận lệnh xóa cuối cùng lên Server Meta
            
            // 🌟 ĐOẠN ĐỘT PHÁ CỦA BẠN: Cộng số lượng, lưu Storage và bắn lệnh nhảy số lên Popup NGAY LẬP TỨC
            localDeletedCount++;
            chrome.storage.local.set({ currentDeletedCount: localDeletedCount });
            chrome.runtime.sendMessage({ action: "updateCounter", count: localDeletedCount });
            console.log(`🗑️ Đã kích nổ thành công bài viết thứ ${localDeletedCount}`);

            // 🌟 TỰ ĐỘNG XÓA CỨNG CONTAINER TRÊN GIAO DIỆN: Ép bài viết biến mất lập tức để dọn chỗ cho bài tiếp theo
            firstItem.blockContainer.remove(); 
            
            await delay(500); // Chỉ nghỉ 0.5 giây ngắn để layout sụt lên ổn định rồi tiến hành quét bài tiếp theo
            continue; 
          }
        }
        
        document.body.click();
        firstItem.blockContainer.remove(); 
        await delay(600);
      } catch (e) {
        document.body.click();
        firstItem.blockContainer.remove();
        await delay(600);
      }
    }
  }
  window.isThreadsCleanerRunning = false;
  chrome.runtime.onMessage.removeListener(statusListener);
}

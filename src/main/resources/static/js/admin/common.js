(function () {
    function getSessionUserId() {
        return sessionStorage.getItem("adminId") || "";
    }

    function checkSession() {
        const adminId = getSessionUserId();

        if (!adminId) {
            window.location.href = "/at-i";
            return false;
        }

        const userNameEl = document.getElementById("userName");
        const userAvatarEl = document.getElementById("userAvatar");

        if (userNameEl) userNameEl.textContent = adminId;
        if (userAvatarEl) userAvatarEl.textContent = adminId.charAt(0).toUpperCase();

        bindPasswordChange(adminId);
        initSessionCountdown();

        return true;
    }

    /* ── 비밀번호 변경 ── */
    function bindPasswordChange(adminId) {
        var pwModal = document.getElementById("pwModal");
        var btnChangePw = document.getElementById("btnChangePw");
        if (!pwModal || !btnChangePw) return;

        var pwModalClose = document.getElementById("pwModalClose");
        var pwModalCancel = document.getElementById("pwModalCancel");
        var pwModalSave = document.getElementById("pwModalSave");
        var currentPw = document.getElementById("currentPassword");
        var newPw = document.getElementById("newPassword");
        var confirmPw = document.getElementById("confirmPassword");
        var pwError = document.getElementById("pwError");

        function openPwModal() {
            currentPw.value = "";
            newPw.value = "";
            confirmPw.value = "";
            hidePwError();
            pwModal.classList.add("show");
            setTimeout(function () { currentPw.focus(); }, 200);
        }

        function closePwModal() {
            pwModal.classList.remove("show");
        }

        function showPwError(msg) {
            pwError.textContent = msg;
            pwError.style.display = "";
        }

        function hidePwError() {
            pwError.textContent = "";
            pwError.style.display = "none";
        }

        function showToastMsg(msg, type) {
            var container = document.getElementById("toastContainer");
            if (!container) return;
            var toast = document.createElement("div");
            toast.className = "toast " + (type || "");
            toast.innerHTML = '<span class="toast-text">' + msg + "</span>";
            container.appendChild(toast);
            setTimeout(function () {
                toast.classList.add("removing");
                toast.addEventListener("animationend", function () { toast.remove(); });
            }, 3000);
        }

        function submitPasswordChange() {
            hidePwError();

            var cur = currentPw.value.trim();
            var np = newPw.value.trim();
            var cp = confirmPw.value.trim();

            if (!cur || !np || !cp) {
                showPwError("모든 항목을 입력해주세요.");
                return;
            }
            if (np !== cp) {
                showPwError("새 비밀번호가 일치하지 않습니다.");
                return;
            }
            if (cur === np) {
                showPwError("현재 비밀번호와 다른 비밀번호를 입력해주세요.");
                return;
            }

            pwModalSave.disabled = true;
            pwModalSave.textContent = "변경 중...";

            var fd = new FormData();
            fd.append("adminId", adminId);
            fd.append("currentPassword", cur);
            fd.append("newPassword", np);

            fetch("/at-i/changePassword", { method: "POST", body: fd })
                .then(function (res) { return res.text(); })
                .then(function (result) {
                    var r = (result || "").trim();
                    if (r === "ok") {
                        closePwModal();
                        showToastMsg("비밀번호가 변경되었습니다.", "success");
                    } else if (r === "WrongPassword") {
                        showPwError("현재 비밀번호가 일치하지 않습니다.");
                    } else {
                        showPwError("비밀번호 변경에 실패했습니다.");
                    }
                })
                .catch(function () {
                    showPwError("서버 오류가 발생했습니다.");
                })
                .finally(function () {
                    pwModalSave.disabled = false;
                    pwModalSave.textContent = "변경";
                });
        }

        btnChangePw.addEventListener("click", openPwModal);
        if (pwModalClose) pwModalClose.addEventListener("click", closePwModal);
        if (pwModalCancel) pwModalCancel.addEventListener("click", closePwModal);
        if (pwModalSave) pwModalSave.addEventListener("click", submitPasswordChange);

        pwModal.addEventListener("click", function (e) {
            if (e.target === pwModal) closePwModal();
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && pwModal.classList.contains("show")) {
                closePwModal();
            }
        });
    }

    function initSessionCountdown() {
        var timerEl = document.getElementById("sessionTimer");
        if (!timerEl) return;

        var remaining = parseInt(timerEl.getAttribute("data-remaining") || "0", 10);
        var timerWrap = timerEl.closest(".session-timer");
        var noteEl = document.getElementById("sessionTimerNote");
        var refreshBtn = document.getElementById("sessionTimerRefresh");
        var warned = false;
        if (!Number.isFinite(remaining) || remaining < 0) {
            remaining = 0;
        }

        function format(seconds) {
            var hrs = Math.floor(seconds / 3600);
            var mins = Math.floor((seconds % 3600) / 60);
            var secs = seconds % 60;
            var hh = String(hrs).padStart(2, "0");
            var mm = String(mins).padStart(2, "0");
            var ss = String(secs).padStart(2, "0");
            return hh + ":" + mm + ":" + ss;
        }

        function update() {
            timerEl.textContent = format(remaining);
            if (timerWrap && noteEl) {
                if (remaining > 0 && remaining <= 300) {
                    timerWrap.classList.add("warning");
                    if (!warned) {
                        noteEl.textContent = "5분 이내 만료";
                        warned = true;
                    }
                } else {
                    timerWrap.classList.remove("warning");
                    noteEl.textContent = "";
                }
            }
        }

        update();
        if (remaining <= 0) return;

        if (refreshBtn) {
            refreshBtn.addEventListener("click", function () {
                refreshSession();
            });
        }

        var intervalId = setInterval(function () {
            remaining -= 1;
            if (remaining <= 0) {
                remaining = 0;
                update();
                clearInterval(intervalId);
                var message = "세션이 만료되었습니다. 다시 로그인해 주세요.";
                window.location.href = "/at-i/error?code=401&message=" + encodeURIComponent(message);
                return;
            }
            update();
        }, 1000);

        bindAutoRefreshOnRequests();

        function refreshSession() {
            fetch("/at-i/session/refresh", { method: "POST" })
                .then(function (res) {
                    if (res.status === 401) {
                        return Promise.reject(new Error("NoSession"));
                    }
                    return res.text();
                })
                .then(function (text) {
                    var next = parseInt(text || "0", 10);
                    if (!Number.isFinite(next) || next <= 0) {
                        return;
                    }
                    remaining = next;
                    timerEl.setAttribute("data-remaining", String(next));
                    update();
                })
                .catch(function () {
                    var message = "세션이 만료되었습니다. 다시 로그인해 주세요.";
                    window.location.href = "/at-i/error?code=401&message=" + encodeURIComponent(message);
                });
        }

        function bindAutoRefreshOnRequests() {
            // 관리자 활동 시 세션 연장: 모든 /at-i 요청에서 갱신(갱신 호출 자체는 제외해 무한루프 방지).
            function shouldRefresh(url) {
                if (!url) return false;
                var path = url;
                var origin = window.location.origin;
                if (path.indexOf(origin) === 0) path = path.slice(origin.length);
                if (path.indexOf("/at-i/") !== 0) return false;
                // 갱신 호출 자체(재귀)·로그인/로그아웃은 제외
                if (path.indexOf("/at-i/session/refresh") === 0) return false;
                if (path.indexOf("/at-i/login") === 0) return false;
                if (path.indexOf("/at-i/logout") === 0) return false;
                return true;
            }

            if (window.jQuery && window.jQuery(document).ajaxComplete) {
                window.jQuery(document).ajaxComplete(function (_event, _xhr, settings) {
                    if (settings && settings.url && shouldRefresh(settings.url)) {
                        refreshSession();
                    }
                });
            }

            if (window.fetch) {
                var originalFetch = window.fetch;
                if (!window.fetch.__sessionRefreshWrapped) {
                    window.fetch = function (input, init) {
                        var url = typeof input === "string" ? input : (input && input.url) || "";
                        var result = originalFetch(input, init);
                        if (shouldRefresh(url)) {
                            result.then(function (res) {
                                if (res && res.ok) {
                                    refreshSession();
                                }
                            }).catch(function () {});
                        }
                        return result;
                    };
                    window.fetch.__sessionRefreshWrapped = true;
                }
            }
        }
    }

    window.checkSession = checkSession;

    /**
     * 관리자 화면 가이드 공용 초기화. 페이지에 아래 마크업이 있어야 동작한다:
     *  - 버튼 #btnScreenGuide, 오버레이 #screenGuideOverlay(> #screenGuideDim, #screenGuideHighlightLayer), 닫기 #btnCloseScreenGuide
     * guideItems: [{ selector, title, text }, ...] (하이라이트할 요소·설명)
     * 스타일은 master.css의 .screen-guide-* 재사용.
     */
    function initAdminScreenGuide(guideItems) {
        var btn = document.getElementById("btnScreenGuide");
        var overlay = document.getElementById("screenGuideOverlay");
        var dim = document.getElementById("screenGuideDim");
        var closeBtn = document.getElementById("btnCloseScreenGuide");
        var layer = document.getElementById("screenGuideHighlightLayer");
        if (!btn || !overlay || !layer || !Array.isArray(guideItems)) return;
        var isOpen = false;

        function clearHighlights() { layer.innerHTML = ""; }

        function render() {
            clearHighlights();
            var occupied = [];
            function overlapArea(a, b) {
                var x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
                var y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
                return x * y;
            }
            function intersectsAny(rect) {
                for (var i = 0; i < occupied.length; i++) { if (overlapArea(rect, occupied[i]) > 0) return true; }
                return false;
            }
            function clampRect(rect, width, height) {
                var m = 8;
                var left = Math.max(m, Math.min(rect.left, window.innerWidth - width - m));
                var top = Math.max(m, Math.min(rect.top, window.innerHeight - height - m));
                return { left: left, top: top, right: left + width, bottom: top + height };
            }
            var shown = 0; // 실제 표시된 항목 순번(숨겨진/미존재 항목은 건너뛰어 번호가 비지 않도록)
            guideItems.forEach(function (item) {
                var target = document.querySelector(item.selector);
                if (!target) return;
                var rect = target.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                shown += 1;

                var pad = 6;
                var box = document.createElement("div");
                box.className = "screen-guide-highlight";
                box.style.top = Math.max(rect.top - pad, 6) + "px";
                box.style.left = Math.max(rect.left - pad, 6) + "px";
                box.style.width = Math.min(rect.width + pad * 2, window.innerWidth - 12) + "px";
                box.style.height = rect.height + pad * 2 + "px";

                var badge = document.createElement("div");
                badge.className = "screen-guide-badge";
                badge.textContent = String(shown);
                badge.style.top = Math.max(rect.top - 16, 4) + "px";
                badge.style.left = Math.max(rect.left - 4, 4) + "px";

                var tooltip = document.createElement("div");
                tooltip.className = "screen-guide-tooltip";
                tooltip.innerHTML = '<div class="screen-guide-tooltip-title"><span class="guide-item-no"></span><span class="gt-title"></span></div><p class="screen-guide-tooltip-text"></p>';
                tooltip.querySelector(".guide-item-no").textContent = String(shown);
                tooltip.querySelector(".gt-title").textContent = item.title || "";
                tooltip.querySelector(".screen-guide-tooltip-text").textContent = item.text || "";
                tooltip.style.left = "-9999px";
                tooltip.style.top = "-9999px";
                layer.appendChild(tooltip);

                var tw = tooltip.offsetWidth || (window.innerWidth <= 768 ? 220 : 260);
                var th = tooltip.offsetHeight || 96;
                var candidates = [
                    { left: rect.right + 10, top: rect.top },
                    { left: rect.left - tw - 10, top: rect.top },
                    { left: rect.right + 10, top: rect.bottom - th },
                    { left: rect.left - tw - 10, top: rect.bottom - th },
                    { left: rect.left, top: rect.bottom + 10 },
                    { left: rect.left, top: rect.top - th - 10 }
                ];
                var best = null, bestScore = Number.MAX_SAFE_INTEGER;
                for (var c = 0; c < candidates.length; c++) {
                    var cr = clampRect({ left: candidates[c].left, top: candidates[c].top }, tw, th);
                    if (!intersectsAny(cr)) { best = cr; break; }
                    var score = 0;
                    for (var o = 0; o < occupied.length; o++) score += overlapArea(cr, occupied[o]);
                    if (score < bestScore) { bestScore = score; best = cr; }
                }
                var attempt = 0;
                while (best && intersectsAny(best) && attempt < 20) {
                    best = clampRect({ left: best.left, top: best.top + 14 + attempt }, tw, th);
                    attempt += 1;
                }
                if (!best) best = clampRect({ left: rect.right + 10, top: rect.top }, tw, th);

                tooltip.style.left = best.left + "px";
                tooltip.style.top = best.top + "px";
                occupied.push(best);
                layer.appendChild(box);
                layer.appendChild(badge);
                layer.appendChild(tooltip);
            });
        }

        function open() { render(); isOpen = true; overlay.classList.add("show"); overlay.setAttribute("aria-hidden", "false"); }
        function close() { isOpen = false; overlay.classList.remove("show"); overlay.setAttribute("aria-hidden", "true"); clearHighlights(); }

        btn.addEventListener("click", open);
        if (closeBtn) closeBtn.addEventListener("click", close);
        if (dim) dim.addEventListener("click", close);
        window.addEventListener("resize", function () { if (isOpen) render(); });
        window.addEventListener("scroll", function () { if (isOpen) render(); }, true);
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) close(); });
    }

    window.initAdminScreenGuide = initAdminScreenGuide;
})();

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
})();

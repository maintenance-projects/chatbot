(function () {
    function getSessionUserId() {
        return sessionStorage.getItem("adminId") || "";
    }

    function checkSession() {
        const adminId = getSessionUserId();

        if (!adminId) {
            window.location.href = "/admin";
            return false;
        }

        const userNameEl = document.getElementById("userName");
        const userAvatarEl = document.getElementById("userAvatar");

        if (userNameEl) userNameEl.textContent = adminId;
        if (userAvatarEl) userAvatarEl.textContent = adminId.charAt(0).toUpperCase();

        bindPasswordChange(adminId);

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

            fetch("/admin/changePassword", { method: "POST", body: fd })
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

    window.checkSession = checkSession;
})();

(function () {
    "use strict";

    const loginForm = document.getElementById("loginForm");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const rememberMeCheckbox = document.getElementById("rememberMe");
    const loginBtn = document.querySelector(".login-btn");
    const btnText = document.querySelector(".btn-text");
    const btnLoader = document.querySelector(".btn-loader");
    const errorMessage = document.getElementById("errorMessage");
    const togglePasswordBtn = document.querySelector(".toggle-password");

    function init() {
        loadSavedCredentials();
        bindEvents();
    }

    function bindEvents() {
        if (loginForm) loginForm.addEventListener("submit", handleLogin);
        if (togglePasswordBtn) togglePasswordBtn.addEventListener("click", togglePasswordVisibility);

        if (usernameInput) usernameInput.addEventListener("focus", hideError);
        if (passwordInput) passwordInput.addEventListener("focus", hideError);

        if (usernameInput) usernameInput.addEventListener("keypress", handleEnterKey);
        if (passwordInput) passwordInput.addEventListener("keypress", handleEnterKey);
    }

    function handleEnterKey(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            if (loginForm) loginForm.dispatchEvent(new Event("submit", { cancelable: true }));
        }
    }

    function togglePasswordVisibility() {
        if (!passwordInput || !togglePasswordBtn) return;

        const eyeOpen = togglePasswordBtn.querySelector(".eye-open");
        const eyeClosed = togglePasswordBtn.querySelector(".eye-closed");

        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            if (eyeOpen) eyeOpen.style.display = "none";
            if (eyeClosed) eyeClosed.style.display = "block";
        } else {
            passwordInput.type = "password";
            if (eyeOpen) eyeOpen.style.display = "block";
            if (eyeClosed) eyeClosed.style.display = "none";
        }
    }

    function loadSavedCredentials() {
        const savedUsername = localStorage.getItem("admin_username");
        const rememberMe = localStorage.getItem("admin_remember") === "true";

        if (rememberMe && savedUsername && usernameInput && rememberMeCheckbox) {
            usernameInput.value = savedUsername;
            rememberMeCheckbox.checked = true;
        }
    }

    function saveCredentials(username) {
        if (!rememberMeCheckbox) return;

        if (rememberMeCheckbox.checked) {
            localStorage.setItem("admin_username", username);
            localStorage.setItem("admin_remember", "true");
        } else {
            localStorage.removeItem("admin_username");
            localStorage.setItem("admin_remember", "false");
        }
    }

    async function handleLogin(e) {
        e.preventDefault();

        const adminId = (usernameInput?.value || "").trim();
        const password = passwordInput?.value || "";

        if (!validateInput(adminId, password)) return;

        setLoadingState(true);
        hideError();

        try {
            const result = await performLoginAjax(adminId, password);

            if (result.code === "ok") {
                saveCredentials(adminId);

                sessionStorage.setItem("adminId", adminId);
                showSuccessAnimation();

                const html = await loadStorageHtmlAjax(adminId);
                history.replaceState(null, "", "/admin/storage");
                replaceDocument(html);
            } else {
                showError(getErrorMessage(result.code, result.status));
            }
        } catch (err) {
            console.error(err);
            showError("서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setLoadingState(false);
        }
    }

    function validateInput(adminId, password) {
        if (!adminId) {
            showError("아이디를 입력해주세요.");
            usernameInput?.focus();
            return false;
        }
        if (!password) {
            showError("비밀번호를 입력해주세요.");
            passwordInput?.focus();
            return false;
        }
        return true;
    }

    function performLoginAjax(adminId, password) {
        return new Promise((resolve, reject) => {
            if (!window.jQuery) {
                reject(new Error("jQuery is not loaded"));
                return;
            }

            $.ajax({
                url: "/admin/login",
                type: "POST",
                contentType: "application/json; charset=UTF-8",
                dataType: "text",
                data: JSON.stringify({ adminId: adminId, password: password }),
                success: function (data, _status, xhr) {
                    const code = String(data || "").trim();
                    resolve({ code: code || String(xhr.status), status: xhr.status });
                },
                error: function (xhr) {
                    const code = String(xhr.responseText || "").trim();
                    resolve({ code: code || String(xhr.status), status: xhr.status });
                }
            });
        });
    }

    function loadStorageHtmlAjax(adminId) {
        return new Promise((resolve, reject) => {
            if (!window.jQuery) {
                reject(new Error("jQuery is not loaded"));
                return;
            }

            $.ajax({
                url: "/admin/storage",
                method: "POST",
                data: { adminId: adminId },
                dataType: "html",
                success: function (html) {
                    resolve(html);

                },
                error: function (xhr) {
                    const status = xhr?.status;
                    reject(new Error("storage load failed: " + status));
                }
            });
        });
    }

    function replaceDocument(html) {
        const doc = document.open("text/html", "replace");
        doc.write(html);
        doc.close();
    }

    function getErrorMessage(code, httpStatus) {
        const c = String(code || "").trim();

        const byCode = {
            NoUser: "아이디가 없습니다.",
            NoPassword: "비밀번호가 틀렸습니다.",
            NoIp: "접속가능한 IP 가 아닙니다."
        };

        if (c === "ok") return "";
        if (byCode[c]) return byCode[c];

        const status = Number.isFinite(Number(c)) ? Number(c) : Number(httpStatus);
        const byStatus = {
            400: "잘못된 요청입니다.",
            401: "아이디 또는 비밀번호가 올바르지 않습니다.",
            403: "접근 권한이 없습니다.",
            404: "서버를 찾을 수 없습니다.",
            405: "허용되지 않은 요청 방식입니다.",
            415: "요청 형식이 올바르지 않습니다.",
            429: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
            500: "서버 오류가 발생했습니다.",
            502: "서버에 연결할 수 없습니다.",
            503: "서비스를 일시적으로 사용할 수 없습니다."
        };

        return byStatus[status] || "알 수 없는 오류가 발생했습니다.";
    }

    function setLoadingState(isLoading) {
        if (loginBtn) loginBtn.disabled = !!isLoading;
        if (btnText) btnText.style.display = isLoading ? "none" : "inline";
        if (btnLoader) btnLoader.style.display = isLoading ? "inline-flex" : "none";
    }

    function showError(message) {
        if (!errorMessage) return;
        const errorSpan = errorMessage.querySelector("span");
        if (errorSpan) errorSpan.textContent = message || "알 수 없는 오류가 발생했습니다.";
        errorMessage.style.display = "flex";
        errorMessage.style.animation = "none";
        void errorMessage.offsetHeight;
        errorMessage.style.animation = "shake 0.4s ease";
    }

    function hideError() {
        if (!errorMessage) return;
        errorMessage.style.display = "none";
    }

    function showSuccessAnimation() {
        if (!loginBtn) return;
        loginBtn.style.background = "#27ae60";
        if (btnText) {
            btnText.textContent = "로그인 성공!";
            btnText.style.display = "inline";
        }
        if (btnLoader) btnLoader.style.display = "none";
    }

    document.addEventListener("DOMContentLoaded", init);
})();

(function () {
    'use strict';

    const errorCode = document.getElementById('errorCode');
    const errorDescription = document.getElementById('errorDescription');
    const btnGoLogin = document.getElementById('btnGoLogin');
    const btnGoBack = document.getElementById('btnGoBack');

    const errorMessages = {
        400: {
            title: '잘못된 요청입니다',
            description: '요청하신 내용을 처리할 수 없습니다.<br>입력 정보를 확인 후 다시 시도해주세요.'
        },
        401: {
            title: '인증이 필요합니다',
            description: '이 페이지에 접근하려면 로그인이 필요합니다.<br>로그인 후 다시 시도해주세요.'
        },
        403: {
            title: '잘못된 접근입니다',
            description: '요청하신 페이지에 접근할 수 없습니다.<br>권한이 없거나 유효하지 않은 요청입니다.'
        },
        404: {
            title: '페이지를 찾을 수 없습니다',
            description: '요청하신 페이지가 존재하지 않거나 삭제되었습니다.<br>주소를 확인 후 다시 시도해주세요.'
        },
        408: {
            title: '요청 시간 초과',
            description: '서버 응답 시간이 초과되었습니다.<br>잠시 후 다시 시도해주세요.'
        },
        500: {
            title: '서버 오류가 발생했습니다',
            description: '일시적인 서버 오류입니다.<br>잠시 후 다시 시도해주세요.'
        },
        502: {
            title: '서버에 연결할 수 없습니다',
            description: '서버가 응답하지 않습니다.<br>잠시 후 다시 시도해주세요.'
        },
        503: {
            title: '서비스 점검 중입니다',
            description: '현재 서비스 점검 중입니다.<br>잠시 후 다시 시도해주세요.'
        }
    };

    function init() {
        parseErrorFromUrl();
        bindEvents();
    }

    function parseErrorFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code') || '403';
        const message = urlParams.get('message');

        updateErrorDisplay(code, message);
    }

    function updateErrorDisplay(code, customMessage) {
        const errorInfo = errorMessages[code] || errorMessages[403];

        if (errorCode) {
            errorCode.textContent = code;
        }

        const errorTitle = document.querySelector('.error-title');
        if (errorTitle) {
            errorTitle.textContent = errorInfo.title;
        }

        if (errorDescription) {
            errorDescription.innerHTML = customMessage || errorInfo.description;
        }

        document.title = `${code} ${errorInfo.title} - 관리자`;
    }

    function bindEvents() {
        if (btnGoLogin) {
            btnGoLogin.addEventListener('click', function () {
                window.location.href = '/admin';
            });
        }

        if (btnGoBack) {
            btnGoBack.addEventListener('click', function () {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = '/admin';
                }
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                window.location.href = '/admin';
            }
        });
    }

    window.redirectToError = function (code, message) {
        let url = `/error.html?code=${code}`;
        if (message) {
            url += `&message=${encodeURIComponent(message)}`;
        }
        window.location.href = url;
    };

    document.addEventListener('DOMContentLoaded', init);

})();
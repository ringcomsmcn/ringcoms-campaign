/* ================================================================
   Firebase 연결 설정 (index.html · l.html 공용)
   Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정 및 구성 → "구성"에 나오는
   firebaseConfig 값을 그대로 붙여넣습니다. 비워두면 데모 모드로 열립니다.
   - PROD: 운영 사이트 ad.ringcoms.com
   - STAGING: 테스트 사이트 staging--cheery-conkies-713ddb.netlify.app (staging 브랜치)
     테스트용 Firebase 프로젝트를 만들기 전에는 비워 두면 데모 모드로만 열립니다.
   ================================================================ */
(function(){
  var PROD = {
    apiKey: "AIzaSyBNaWeb6ul2agnfe5ILD1ur5zu_FyVciuA",
    authDomain: "ringcoms-campaign.firebaseapp.com",
    projectId: "ringcoms-campaign",
    storageBucket: "ringcoms-campaign.firebasestorage.app",
    messagingSenderId: "662253106703",
    appId: "1:662253106703:web:314e3d1d9fd18f5bcb957a"
  };
  var STAGING = {
    /* 테스트용 Firebase 프로젝트의 firebaseConfig를 여기에 붙여넣기 */
  };
  /* staging 브랜치 배포 주소(staging--…netlify.app)는 테스트 환경 — 운영 데이터에 절대 연결하지 않음 */
  var staging = /^staging--/.test(location.hostname);
  window.APP_ENV = staging ? 'staging' : 'production';
  window.FIREBASE_CONFIG = staging ? STAGING : PROD;
})();
/* 테스트 환경 표시: 화면 아래쪽에 「테스트 환경」 띠 */
if (window.APP_ENV === 'staging') document.addEventListener('DOMContentLoaded', function(){
  var b = document.createElement('div');
  b.textContent = '테스트 환경 (staging) · 운영 데이터와 분리되어 있습니다';
  b.style.cssText = 'position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:99999;background:#A95205;color:#fff;font:600 12px/1.2 sans-serif;padding:6px 12px;border-radius:999px;pointer-events:none;opacity:.92;white-space:nowrap';
  document.body.appendChild(b);
});

export function initAuth() {
    const screen = document.getElementById('login-screen');
    const app = document.getElementById('app-container');
    const btnLogin = document.getElementById('btn-login');
    const pinInput = document.getElementById('pin-input');
    const btnLogout = document.getElementById('btn-logout');

    // PIN Default: 1234
    const CORRECT_PIN = "1234";

    // Cek sesi login sebelumnya
    if(localStorage.getItem('isLoggedIn') === 'true') {
        screen.classList.add('hidden');
        app.classList.remove('hidden');
    }

    btnLogin.addEventListener('click', () => {
        if(pinInput.value === CORRECT_PIN) {
            localStorage.setItem('isLoggedIn', 'true');
            screen.classList.add('hidden');
            app.classList.remove('hidden');
        } else {
            alert("PIN Salah! Coba lagi.");
            pinInput.value = '';
        }
    });

    btnLogout.addEventListener('click', () => {
        if(confirm("Yakin mau logout?")) {
            localStorage.removeItem('isLoggedIn');
            location.reload();
        }
    });
}
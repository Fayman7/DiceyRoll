export async function apiFetch(endpoint, options = {}) {
    const accessToken = localStorage.getItem('accessToken');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (options.body instanceof FormData) {
        delete headers['Content-Type']
    }

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response = await fetch(`${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        const refreshed = await refreshTokens();
        
        if (refreshed) {
            const newAccessToken = localStorage.getItem('accessToken');
            
            headers['Authorization'] = `Bearer ${newAccessToken}`;
            
            response = await fetch(`${endpoint}`, {
                ...options,
                headers,
            });
        } else {
            logout();
        }
    }
    return response;
}

async function refreshTokens() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
        const res = await fetch(`http://localhost:4242/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            return true;
        }
    } catch (err) {
        console.error("Ошибка при обновлении токена", err);
    }
    return false; 
}

export function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    window.location.href = '/auth';
}
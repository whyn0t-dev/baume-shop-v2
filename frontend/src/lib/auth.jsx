import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	useRef,
} from "react";

import { fetchMe, loginUser, logoutUser, registerUser, updateMe } from "./api";

const AuthContext = createContext(null);

const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes
const REMEMBER_LIMIT = 60 * 60 * 1000; // 1 heure

const STORAGE = {
	accessToken: "access_token",
	refreshToken: "refresh_token",
	expiresAt: "session_expires_at",
	lastActivity: "session_last_activity",
	rememberMe: "session_remember_me",
};

function clearSessionStorage() {
	Object.values(STORAGE).forEach((key) => {
		localStorage.removeItem(key);
	});
}

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [status, setStatus] = useState("loading");

	const logoutInProgress = useRef(false);
	const lastActivityWrite = useRef(0);

	// Vérifie si la session a expiré.
	const isSessionExpired = useCallback(() => {
		const token = localStorage.getItem(STORAGE.accessToken);

		if (!token) {
			return true;
		}

		const now = Date.now();

		const rememberMe = localStorage.getItem(STORAGE.rememberMe) === "true";

		if (rememberMe) {
			const expiresAt = Number(localStorage.getItem(STORAGE.expiresAt));

			// Une session "Rester connecté" doit
			// impérativement avoir une date d'expiration.
			return !expiresAt || now >= expiresAt;
		}

		const lastActivity = Number(localStorage.getItem(STORAGE.lastActivity));

		// Session classique : 5 minutes d'inactivité.
		return !lastActivity || now - lastActivity >= INACTIVITY_LIMIT;
	}, []);

	const refreshMe = useCallback(async () => {
		if (isSessionExpired()) {
			setUser(null);
			setStatus("guest");
			return null;
		}

		try {
			const data = await fetchMe();

			// L'utilisateur peut avoir été déconnecté
			// pendant le chargement de son profil.
			if (isSessionExpired()) {
				setUser(null);
				setStatus("guest");
				return null;
			}

			setUser(data);
			setStatus("authenticated");

			return data;
		} catch {
			clearSessionStorage();

			setUser(null);
			setStatus("guest");

			return null;
		}
	}, [isSessionExpired]);

	// Déconnexion locale immédiate, suivie
	// d'une tentative de déconnexion auprès de l'API.
	const logout = useCallback(async () => {
		if (logoutInProgress.current) {
			return;
		}

		logoutInProgress.current = true;

		// Conserver temporairement les jetons pour
		// que logoutUser puisse les utiliser.
		try {
			await logoutUser();
		} catch (error) {
			console.warn("Déconnexion API impossible :", error);
		} finally {
			clearSessionStorage();

			setUser(null);
			setStatus("guest");

			logoutInProgress.current = false;
		}
	}, []);

	const login = useCallback(
		async (email, password, options = {}) => {
			const data = await loginUser({
				email,
				password,
			});

			const rememberMe = Boolean(options.rememberMe);

			const now = Date.now();

			localStorage.setItem(STORAGE.accessToken, data.access_token);

			if (data.refresh_token) {
				localStorage.setItem(STORAGE.refreshToken, data.refresh_token);
			} else {
				localStorage.removeItem(STORAGE.refreshToken);
			}

			localStorage.setItem(STORAGE.rememberMe, String(rememberMe));

			localStorage.setItem(STORAGE.lastActivity, String(now));

			if (rememberMe) {
				localStorage.setItem(STORAGE.expiresAt, String(now + REMEMBER_LIMIT));
			} else {
				localStorage.removeItem(STORAGE.expiresAt);
			}

			return await refreshMe();
		},
		[refreshMe],
	);

	const register = useCallback(async (payload) => {
		const data = await registerUser(payload);

		if (!data.access_token) {
			// Certains systèmes demandent de confirmer
			// l'adresse e-mail avant la connexion.
			setUser(null);
			setStatus("guest");
			return data.user;
		}

		localStorage.setItem(STORAGE.accessToken, data.access_token);

		if (data.refresh_token) {
			localStorage.setItem(STORAGE.refreshToken, data.refresh_token);
		}

		localStorage.setItem(STORAGE.rememberMe, "false");

		localStorage.setItem(STORAGE.lastActivity, String(Date.now()));

		localStorage.removeItem(STORAGE.expiresAt);

		setUser(data.user);
		setStatus("authenticated");

		return data.user;
	}, []);

	const saveProfile = useCallback(async (payload) => {
		const data = await updateMe(payload);

		setUser(data);

		return data;
	}, []);

	// Rétablir la session lors du chargement de la page.
	useEffect(() => {
		const token = localStorage.getItem(STORAGE.accessToken);

		if (!token) {
			setUser(null);
			setStatus("guest");
			return;
		}

		if (isSessionExpired()) {
			logout();
			return;
		}

		refreshMe();
	}, [isSessionExpired, refreshMe, logout]);

	// Surveiller les délais de session.
	useEffect(() => {
		if (status !== "authenticated") {
			return;
		}

		const checkSession = () => {
			if (isSessionExpired()) {
				logout();
			}
		};

		// Contrôle toutes les 5 secondes.
		const interval = setInterval(checkSession, 5000);

		// Recontrôler immédiatement lorsque
		// l'utilisateur revient sur l'onglet.
		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				checkSession();
			}
		};

		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			clearInterval(interval);

			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [status, isSessionExpired, logout]);

	// Enregistrer les activités de l'utilisateur.
	useEffect(() => {
		if (status !== "authenticated") {
			return;
		}

		const onActivity = () => {
			const rememberMe = localStorage.getItem(STORAGE.rememberMe) === "true";

			// En mode "Rester connecté", la limite
			// d'une heure est absolue.
			if (rememberMe) {
				return;
			}

			const now = Date.now();

			// Ne pas réactiver une session déjà expirée.
			if (isSessionExpired()) {
				logout();
				return;
			}

			// Limiter les écritures dans localStorage.
			if (now - lastActivityWrite.current < 1000) {
				return;
			}

			lastActivityWrite.current = now;

			localStorage.setItem(STORAGE.lastActivity, String(now));
		};

		const events = ["pointerdown", "keydown", "scroll", "touchstart"];

		events.forEach((eventName) => {
			window.addEventListener(eventName, onActivity, { passive: true });
		});

		return () => {
			events.forEach((eventName) => {
				window.removeEventListener(eventName, onActivity);
			});
		};
	}, [status, isSessionExpired, logout]);

	// Synchroniser la déconnexion entre les onglets.
	useEffect(() => {
		const onStorageChange = (event) => {
			if (event.key === STORAGE.accessToken && !event.newValue) {
				setUser(null);
				setStatus("guest");
			}
		};

		window.addEventListener("storage", onStorageChange);

		return () => {
			window.removeEventListener("storage", onStorageChange);
		};
	}, []);

	return (
		<AuthContext.Provider
			value={{
				user,
				status,
				isAuth: status === "authenticated",
				login,
				register,
				logout,
				refreshMe,
				saveProfile,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export const useAuth = () => {
	const ctx = useContext(AuthContext);

	if (!ctx) {
		throw new Error("useAuth must be inside AuthProvider");
	}

	return ctx;
};

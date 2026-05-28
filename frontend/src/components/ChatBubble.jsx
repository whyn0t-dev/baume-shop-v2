import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Lock, Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { createClient } from "@supabase/supabase-js";

export default function ChatBubble() {
	const { user, status } = useAuth();
	const [open, setOpen] = useState(false);
	const [conversation, setConversation] = useState(null);
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [sending, setSending] = useState(false);
	const [unread, setUnread] = useState(0);
	const bottomRef = useRef(null);
	const channelRef = useRef(null);

	const isLoggedIn = status === "authenticated" && user;
	const isLocked = conversation?.status === "locked";

	// ← Créer le client ici à l'intérieur
	const supabaseRef = useRef(null);
	if (!supabaseRef.current && process.env.REACT_APP_SUPABASE_URL) {
		supabaseRef.current = createClient(
			process.env.REACT_APP_SUPABASE_URL,
			process.env.REACT_APP_SUPABASE_ANON_KEY,
		);
	}
	const supabase = supabaseRef.current;

	const [isAdminTyping, setIsAdminTyping] = useState(false);
	const typingTimeoutRef = useRef(null);

	const pollingRef = useRef(null);

	function subscribeToMessages(conversationId) {
		if (pollingRef.current) clearInterval(pollingRef.current);

		pollingRef.current = setInterval(async () => {
			try {
				const msgs = await api
					.get(`/conversations/${conversationId}/messages`)
					.then((r) => r.data);
				setMessages(msgs || []);

				// Vérifier la conversation pour le statut et le typing
				const convs = await api.get("/conversations/mine").then((r) => r.data);
				if (convs?.[0]) {
					const conv = convs[0];
					setConversation(conv);

					// ← Détecter si l'admin est en train d'écrire
					const adminTypingAt = conv.admin_typing_at
						? new Date(conv.admin_typing_at)
						: null;
					setIsAdminTyping(adminTypingAt && new Date() - adminTypingAt < 3000);
				}
			} catch (err) {
				// Silencieux
			}
		}, 2000);
	}

	// Cleanup dans useEffect
	useEffect(() => {
		return () => {
			if (pollingRef.current) clearInterval(pollingRef.current);
		};
	}, []);

	// Arrêter le polling quand le chat est fermé
	useEffect(() => {
		if (!open && pollingRef.current) {
			clearInterval(pollingRef.current);
			pollingRef.current = null;
		}
	}, [open]);

	// Envoyer l'état "typing" quand le client écrit
	const handleInputChange = async (e) => {
		setInput(e.target.value);
		if (!conversation) return;

		clearTimeout(typingTimeoutRef.current);

		try {
			await api.patch(`/conversations/${conversation.id}/typing`, {
				role: "customer",
			});
		} catch {}

		typingTimeoutRef.current = setTimeout(async () => {
			try {
				await api.patch(`/conversations/${conversation.id}/typing`, {
					role: null,
				});
			} catch {}
		}, 2000);
	};

	// ── Charger la conversation existante ────────────────────────────────
	useEffect(() => {
		if (!isLoggedIn || !open) return;
		loadConversation();
	}, [isLoggedIn, open]);

	async function loadConversation() {
		setLoading(true);
		try {
			// ← Authentifier le client Supabase Realtime
			if (supabase) {
				const token = localStorage.getItem("access_token");
				if (token) await supabase.realtime.setAuth(token);
			}

			const convs = await api.get("/conversations/mine").then((r) => r.data);
			if (convs && convs.length > 0) {
				const conv = convs[0];
				setConversation(conv);
				const msgs = await api
					.get(`/conversations/${conv.id}/messages`)
					.then((r) => r.data);
				setMessages(msgs || []);
				subscribeToMessages(conv.id);
			}
		} catch (err) {
			console.error("Chat load error:", err);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (open) setUnread(0);
	}, [open]);

	// Remplacer bottomRef par messagesContainerRef
	const messagesContainerRef = useRef(null);
	const lastMessageIdRef = useRef(null);

	useEffect(() => {
		if (messages.length === 0) return;
		const lastMessage = messages[messages.length - 1];
		if (lastMessage?.id !== lastMessageIdRef.current) {
			lastMessageIdRef.current = lastMessage?.id;
			// ← Scroller le conteneur, pas la page
			if (messagesContainerRef.current) {
				messagesContainerRef.current.scrollTop =
					messagesContainerRef.current.scrollHeight;
			}
		}
	}, [messages]);

	useEffect(() => {
		return () => {
			if (channelRef.current) supabase.removeChannel(channelRef.current);
		};
	}, []);

	async function handleSend() {
		if (!input.trim() || sending || isLocked) return;
		setSending(true);
		const content = input.trim();
		setInput("");

		try {
			if (!conversation) {
				const conv = await api
					.post("/conversations", { content })
					.then((r) => r.data);
				setConversation(conv);
				const msgs = await api
					.get(`/conversations/${conv.id}/messages`)
					.then((r) => r.data);
				setMessages(msgs || []);
				subscribeToMessages(conv.id);
			} else {
				const sent = await api
					.post(`/conversations/${conversation.id}/messages`, { content })
					.then((r) => r.data);

				// ← Ajouter le message localement immédiatement
				setMessages((prev) => {
					if (prev.find((m) => m.id === sent.id)) return prev;
					return [...prev, sent];
				});
			}
		} catch (err) {
			console.error("Send error:", err);
			setInput(content); // ← Restaurer en cas d'erreur
		} finally {
			setSending(false);
		}
	}

	// ── Pas connecté ──────────────────────────────────────────────────────
	if (!isLoggedIn) {
		return (
			<div className="fixed bottom-6 right-6 z-50">
				{open ? (
					// Popup ouverte — uniquement la popup, pas de bouton
					<div className="w-80 rounded-3xl border border-baume-border bg-baume-white shadow-xl overflow-hidden">
						{/* Header avec croix */}
						<div className="bg-baume-burgundy px-5 py-4 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 rounded-full bg-baume-white/20 flex items-center justify-center">
									<MessageCircle className="h-4 w-4 text-baume-white" />
								</div>
								<p className="text-[14px] font-semibold text-baume-white">
									Expertes Baume
								</p>
							</div>
							<button
								onClick={() => setOpen(false)}
								className="h-8 w-8 rounded-full bg-baume-white/10 flex items-center justify-center hover:bg-baume-white/20 transition"
							>
								<X className="h-4 w-4 text-baume-white" />
							</button>
						</div>

						{/* Corps */}
						<div className="p-6 text-center">
							<p className="font-editorial text-[20px] text-baume-charcoal mb-2">
								Besoin d'aide ?
							</p>
							<p className="text-[13px] text-baume-charcoal/60 mb-4">
								Connectez-vous pour discuter avec nos expertes.
							</p>

							<a
								href="/connexion"
								className="inline-flex h-10 px-5 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold items-center justify-center hover:bg-baume-burgundyDark transition"
							>
								Se connecter
							</a>
						</div>
					</div>
				) : (
					// Popup fermée — uniquement le bouton
					<button
						onClick={() => setOpen(true)}
						className="h-14 w-14 rounded-full bg-baume-burgundy text-baume-white shadow-lg flex items-center justify-center hover:bg-baume-burgundyDark transition"
					>
						<MessageCircle className="h-6 w-6" />
					</button>
				)}
			</div>
		);
	}
	return (
		<div className="fixed bottom-6 right-6 z-50">
			{open ? (
				// Popup ouverte — uniquement la fenêtre de chat, pas de bouton
				<div
					className="w-[360px] rounded-3xl border border-baume-border bg-baume-white shadow-2xl flex flex-col overflow-hidden"
					style={{ height: "480px" }}
				>
					{/* Header */}
					<div className="bg-baume-burgundy px-5 py-4 flex items-center justify-between shrink-0">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded-full bg-baume-white/20 flex items-center justify-center">
								<MessageCircle className="h-4 w-4 text-baume-white" />
							</div>
							<div>
								<p className="text-[14px] font-semibold text-baume-white">
									Expertes Baume
								</p>
								<p className="text-[11px] text-baume-white/60">
									{isLocked ? "Conversation verrouillée" : "En ligne"}
								</p>
							</div>
						</div>
						<button
							onClick={() => setOpen(false)}
							className="h-8 w-8 rounded-full bg-baume-white/10 flex items-center justify-center hover:bg-baume-white/20 transition"
						>
							<X className="h-4 w-4 text-baume-white" />
						</button>
					</div>

					{/* Messages */}
					<div
						ref={messagesContainerRef}
						className="flex-1 overflow-y-auto p-4 space-y-3 bg-baume-ivory/30"
					>
						{loading ? (
							<div className="flex items-center justify-center h-full">
								<Loader2 className="h-6 w-6 animate-spin text-baume-burgundy" />
							</div>
						) : messages.length === 0 ? (
							<div className="text-center pt-8">
								<p className="text-[13px] text-baume-charcoal/50">
									Bonjour {user?.first_name || ""} 👋
								</p>
								<p className="text-[13px] text-baume-charcoal/50 mt-1">
									Comment pouvons-nous vous aider ?
								</p>
							</div>
						) : (
							messages.map((msg) => (
								<MessageBubble
									key={msg.id}
									message={msg}
									isOwn={msg.sender_role === "customer"}
								/>
							))
						)}
						{isAdminTyping && (
							<div className="flex justify-start">
								<div className="bg-baume-white border border-baume-border rounded-2xl rounded-bl-sm px-4 py-2.5">
									<p className="text-[10px] font-semibold text-baume-burgundy mb-0.5">
										Experte Baume
									</p>
									<div className="flex items-center gap-1">
										<span
											className="w-1.5 h-1.5 rounded-full bg-baume-charcoal/40 animate-bounce"
											style={{ animationDelay: "0ms" }}
										/>
										<span
											className="w-1.5 h-1.5 rounded-full bg-baume-charcoal/40 animate-bounce"
											style={{ animationDelay: "150ms" }}
										/>
										<span
											className="w-1.5 h-1.5 rounded-full bg-baume-charcoal/40 animate-bounce"
											style={{ animationDelay: "300ms" }}
										/>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Input */}
					{isLocked ? (
						<div className="px-4 py-3 border-t border-baume-border bg-baume-ivory/50 flex items-center gap-2 shrink-0">
							<Lock className="h-4 w-4 text-baume-charcoal/40 shrink-0" />
							<p className="text-[12px] text-baume-charcoal/50">
								Cette conversation est verrouillée.
							</p>
						</div>
					) : (
						<div className="px-3 py-3 border-t border-baume-border bg-baume-white shrink-0">
							<div className="flex items-end gap-2">
								<textarea
									value={input}
									onChange={handleInputChange}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											handleSend();
										}
									}}
									placeholder="Votre message…"
									rows={1}
									className="flex-1 resize-none rounded-2xl border border-baume-border bg-baume-ivory px-3 py-2.5 text-[13px] text-baume-charcoal outline-none focus:ring-2 focus:ring-baume-taupe max-h-24"
									style={{ minHeight: "40px" }}
								/>
								<button
									onClick={handleSend}
									disabled={!input.trim() || sending}
									className="h-10 w-10 rounded-full bg-baume-burgundy text-baume-white flex items-center justify-center hover:bg-baume-burgundyDark transition disabled:opacity-50 shrink-0"
								>
									{sending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Send className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>
					)}
				</div>
			) : (
				// Popup fermée — uniquement le bouton
				<button
					onClick={() => setOpen(true)}
					className="relative h-14 w-14 rounded-full bg-baume-burgundy text-baume-white shadow-lg flex items-center justify-center hover:bg-baume-burgundyDark transition"
				>
					<MessageCircle className="h-6 w-6" />
					{unread > 0 && (
						<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
							{unread}
						</span>
					)}
				</button>
			)}
		</div>
	);
}

function MessageBubble({ message, isOwn }) {
	const time = new Date(message.created_at).toLocaleTimeString("fr-CH", {
		hour: "2-digit",
		minute: "2-digit",
	});

	return (
		<div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[75%] rounded-2xl px-3 py-2 ${
					isOwn
						? "bg-baume-burgundy text-baume-white rounded-br-sm"
						: "bg-baume-white border border-baume-border text-baume-charcoal rounded-bl-sm"
				}`}
			>
				{!isOwn && (
					<p className="text-[10px] font-semibold text-baume-burgundy mb-0.5">
						Experte Baume
					</p>
				)}
				<p className="text-[13px] leading-[1.5] whitespace-pre-wrap">
					{message.content}
				</p>
				<p
					className={`text-[10px] mt-1 ${
						isOwn ? "text-baume-white/60" : "text-baume-charcoal/40"
					}`}
				>
					{time}
				</p>
			</div>
		</div>
	);
}

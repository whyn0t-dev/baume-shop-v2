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

	// ── Charger la conversation existante ────────────────────────────────
	useEffect(() => {
		if (!isLoggedIn || !open) return;
		loadConversation();
	}, [isLoggedIn, open]);

	async function loadConversation() {
		setLoading(true);
		try {
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

	// ── Realtime Supabase ─────────────────────────────────────────────────
	function subscribeToMessages(conversationId) {
		if (channelRef.current) {
			supabase.removeChannel(channelRef.current);
		}

		const channel = supabase
			.channel(`messages:${conversationId}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "messages",
					filter: `conversation_id=eq.${conversationId}`,
				},
				(payload) => {
					const newMsg = payload.new;
					setMessages((prev) => {
						if (prev.find((m) => m.id === newMsg.id)) return prev;
						return [...prev, newMsg];
					});
					if (!open && newMsg.sender_role === "admin") {
						setUnread((n) => n + 1);
					}
				},
			)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "conversations",
					filter: `id=eq.${conversationId}`,
				},
				(payload) => {
					setConversation(payload.new);
				},
			)
			.subscribe();

		channelRef.current = channel;
	}

	useEffect(() => {
		if (open) setUnread(0);
	}, [open]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	useEffect(() => {
		return () => {
			if (channelRef.current) supabase.removeChannel(channelRef.current);
		};
	}, []);

	async function handleSend() {
		if (!input.trim() || sending || isLocked) return;
		setSending(true);

		try {
			if (!conversation) {
				// Créer la conversation avec le premier message
				const conv = await api
					.post("/conversations", { content: input.trim() })
					.then((r) => r.data);
				setConversation(conv);
				const msgs = await api
					.get(`/conversations/${conv.id}/messages`)
					.then((r) => r.data);
				setMessages(msgs || []);
				subscribeToMessages(conv.id);
			} else {
				await api.post(`/conversations/${conversation.id}/messages`, {
					content: input.trim(),
				});
			}
			setInput("");
		} catch (err) {
			console.error("Send error:", err);
		} finally {
			setSending(false);
		}
	}

	// ── Pas connecté ──────────────────────────────────────────────────────
	if (!isLoggedIn) {
		return (
			<div className="fixed bottom-6 right-6 z-50">
				{open && (
					<div className="mb-3 w-80 rounded-3xl border border-baume-border bg-baume-white shadow-xl p-6 text-center">
						<div className="w-12 h-12 rounded-full bg-baume-burgundy/10 flex items-center justify-center mx-auto mb-4">
							<MessageCircle className="h-6 w-6 text-baume-burgundy" />
						</div>
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
				)}
				<button
					onClick={() => setOpen((v) => !v)}
					className="h-14 w-14 rounded-full bg-baume-burgundy text-baume-white shadow-lg flex items-center justify-center hover:bg-baume-burgundyDark transition"
				>
					{open ? (
						<X className="h-5 w-5" />
					) : (
						<MessageCircle className="h-6 w-6" />
					)}
				</button>
			</div>
		);
	}

	return (
		<div className="fixed bottom-6 right-6 z-50">
			{/* Fenêtre de chat */}
			{open && (
				<div
					className="mb-3 w-[360px] rounded-3xl border border-baume-border bg-baume-white shadow-2xl flex flex-col overflow-hidden"
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
					<div className="flex-1 overflow-y-auto p-4 space-y-3 bg-baume-ivory/30">
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
						<div ref={bottomRef} />
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
									onChange={(e) => setInput(e.target.value)}
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
			)}

			{/* Bouton flottant */}
			<button
				onClick={() => setOpen((v) => !v)}
				className="relative h-14 w-14 rounded-full bg-baume-burgundy text-baume-white shadow-lg flex items-center justify-center hover:bg-baume-burgundyDark transition"
			>
				{open ? (
					<X className="h-5 w-5" />
				) : (
					<MessageCircle className="h-6 w-6" />
				)}
				{unread > 0 && !open && (
					<span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
						{unread}
					</span>
				)}
			</button>
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

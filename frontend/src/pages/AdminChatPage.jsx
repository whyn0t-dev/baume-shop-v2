import React, { useEffect, useRef, useState } from "react";
import {
	Lock,
	Trash2,
	Unlock,
	Send,
	Loader2,
	MessageCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function AdminChatPage() {
	const { user, status } = useAuth();

	const [conversations, setConversations] = useState([]);
	const [selected, setSelected] = useState(null);
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [filter, setFilter] = useState("open");

	const [isCustomerTyping, setIsCustomerTyping] = useState(false);
	const typingTimeoutRef = useRef(null);

	const pollingRef = useRef(null);

	function subscribeToMessages(conversationId) {
		if (pollingRef.current) clearInterval(pollingRef.current);

		pollingRef.current = setInterval(async () => {
			try {
				const data = await api
					.get(`/conversations/${conversationId}/messages`)
					.then((r) => r.data);
				setMessages(data || []);

				// ← Détecter si le client est en train d'écrire
				const convData = await api
					.get("/ecom/admin/conversations")
					.then((r) => r.data);
				const currentConv = convData?.find((c) => c.id === conversationId);
				if (currentConv) {
					const customerTypingAt = currentConv.customer_typing_at
						? new Date(currentConv.customer_typing_at)
						: null;
					setIsCustomerTyping(
						customerTypingAt && new Date() - customerTypingAt < 3000,
					);
				}
			} catch (err) {
				// Silencieux
			}
		}, 2000);
	}

	// ← Relancer le polling quand l'onglet redevient actif
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible" && selected) {
				subscribeToMessages(selected.id);
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, [selected]);

	// Dans le useEffect de cleanup existant
	useEffect(() => {
		return () => {
			if (pollingRef.current) clearInterval(pollingRef.current);
		};
	}, []);

	// Arrêter le polling quand on change de conversation
	useEffect(() => {
		if (pollingRef.current) clearInterval(pollingRef.current);
		if (selected) loadMessages(selected.id);
	}, [selected]);

	const handleInputChange = async (e) => {
		setInput(e.target.value);
		if (!selected) return;

		clearTimeout(typingTimeoutRef.current);

		try {
			await api.patch(`/conversations/${selected.id}/typing`, {
				role: "admin",
			});
		} catch {}

		typingTimeoutRef.current = setTimeout(async () => {
			try {
				await api.patch(`/conversations/${selected.id}/typing`, {
					role: null,
				});
			} catch {}
		}, 2000);
	};

	useEffect(() => {
		loadConversations();
	}, [filter]);

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

	async function loadConversations() {
		try {
			const data = await api
				.get(`/ecom/admin/conversations?status=${filter}`)
				.then((r) => r.data);
			setConversations(data || []);
		} catch (err) {
			console.error(err);
		}
	}

	async function loadMessages(conversationId) {
		try {
			const data = await api
				.get(`/conversations/${conversationId}/messages`)
				.then((r) => r.data);
			setMessages(data || []);
			subscribeToMessages(conversationId);
		} catch (err) {
			console.error(err);
		}
	}

	async function handleSend() {
		if (!input.trim() || sending || !selected) return;
		setSending(true);
		const content = input.trim();
		setInput("");

		try {
			const sent = await api
				.post(`/conversations/${selected.id}/messages`, { content })
				.then((r) => r.data);

			// ← Ajouter le message localement immédiatement
			setMessages((prev) => {
				if (prev.find((m) => m.id === sent.id)) return prev;
				return [...prev, sent];
			});
		} catch (err) {
			console.error(err);
			setInput(content); // ← Restaurer le message en cas d'erreur
		} finally {
			setSending(false);
		}
	}

	async function handleLock(conv) {
		try {
			await api.patch(`/ecom/admin/conversations/${conv.id}/lock`);
			setConversations((prev) =>
				prev.map((c) => (c.id === conv.id ? { ...c, status: "locked" } : c)),
			);
			if (selected?.id === conv.id)
				setSelected((s) => ({ ...s, status: "locked" }));
		} catch (err) {
			console.error(err);
		}
	}

	async function handleUnlock(conv) {
		try {
			await api.patch(`/ecom/admin/conversations/${conv.id}/unlock`);
			setConversations((prev) =>
				prev.map((c) => (c.id === conv.id ? { ...c, status: "open" } : c)),
			);
			if (selected?.id === conv.id)
				setSelected((s) => ({ ...s, status: "open" }));
		} catch (err) {
			console.error(err);
		}
	}

	async function handleDelete(conv) {
		if (!window.confirm("Supprimer cette conversation définitivement ?"))
			return;
		try {
			await api.delete(`/ecom/admin/conversations/${conv.id}`);
			setConversations((prev) => prev.filter((c) => c.id !== conv.id));
			if (selected?.id === conv.id) {
				setSelected(null);
				setMessages([]);
			}
		} catch (err) {
			console.error(err);
		}
	}

	if (status === "loading") return null;
	if (!user) return null;

	return (
		<div className="h-screen bg-baume-ivory flex flex-col overflow-hidden">
			<div className="px-6 lg:px-10 py-8 shrink-0">
				<p className="text-[12px] uppercase tracking-[0.22em] text-baume-burgundy font-semibold">
					Admin
				</p>
				<h1 className="mt-1 text-[32px] font-semibold text-baume-burgundy">
					Conversations
				</h1>
			</div>

			<div className="flex flex-1 min-h-0 gap-0 px-6 lg:px-10 pb-8 overflow-hidden">
				{/* Colonne gauche — liste */}
				<div className="w-80 shrink-0 rounded-3xl border border-baume-border bg-baume-white mr-4 flex flex-col overflow-hidden">
					{/* Filtres */}
					<div className="p-4 border-b border-baume-border flex gap-2">
						{["open", "locked"].map((s) => (
							<button
								key={s}
								onClick={() => setFilter(s)}
								className={`flex-1 h-9 rounded-full text-[12px] font-semibold transition ${
									filter === s
										? "bg-baume-burgundy text-baume-white"
										: "bg-baume-ivory text-baume-charcoal/60 border border-baume-border"
								}`}
							>
								{s === "open" ? "Ouvertes" : "Verrouillées"}
							</button>
						))}
					</div>

					{/* Liste conversations */}
					<div className="flex-1 overflow-y-auto divide-y divide-baume-border">
						{conversations.length === 0 ? (
							<div className="p-6 text-center text-[13px] text-baume-charcoal/50">
								Aucune conversation
							</div>
						) : (
							conversations.map((conv) => (
								<button
									key={conv.id}
									onClick={() => setSelected(conv)}
									className={`w-full text-left px-4 py-4 hover:bg-baume-ivory transition ${
										selected?.id === conv.id ? "bg-baume-ivory" : ""
									}`}
								>
									<div className="flex items-center justify-between gap-2 mb-1">
										<p className="text-[13px] font-semibold text-baume-charcoal truncate">
											{conv.email || "Client anonyme"}
										</p>
										{conv.status === "locked" && (
											<Lock className="h-3.5 w-3.5 text-baume-charcoal/40 shrink-0" />
										)}
									</div>
									<p className="text-[11px] text-baume-charcoal/50">
										{new Date(conv.last_message_at).toLocaleString("fr-CH", {
											day: "numeric",
											month: "short",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
								</button>
							))
						)}
					</div>
				</div>

				{/* Colonne droite — messages */}
				<div className="flex-1 rounded-3xl border border-baume-border bg-baume-white flex flex-col overflow-hidden">
					{!selected ? (
						<div className="flex-1 flex items-center justify-center text-center">
							<div>
								<MessageCircle className="h-10 w-10 text-baume-charcoal/20 mx-auto mb-3" />
								<p className="text-[14px] text-baume-charcoal/40">
									Sélectionnez une conversation
								</p>
							</div>
						</div>
					) : (
						<>
							{/* Header conversation */}
							<div className="px-5 py-4 border-b border-baume-border flex items-center justify-between shrink-0">
								<div>
									<p className="text-[14px] font-semibold text-baume-charcoal">
										{selected.email || "Client anonyme"}
									</p>
									<p className="text-[12px] text-baume-charcoal/50">
										{selected.status === "locked"
											? "🔒 Verrouillée"
											: "🟢 Ouverte"}{" "}
										·{" "}
										{new Date(selected.created_at).toLocaleDateString("fr-CH")}
									</p>
								</div>

								<div className="flex items-center gap-2">
									{selected.status === "locked" ? (
										<button
											onClick={() => handleUnlock(selected)}
											className="h-9 px-4 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-semibold hover:bg-emerald-100 transition inline-flex items-center gap-1.5"
										>
											<Unlock className="h-3.5 w-3.5" />
											Déverrouiller
										</button>
									) : (
										<button
											onClick={() => handleLock(selected)}
											className="h-9 px-4 rounded-full bg-baume-ivory border border-baume-border text-baume-charcoal/70 text-[12px] font-semibold hover:bg-baume-charcoal/5 transition inline-flex items-center gap-1.5"
										>
											<Lock className="h-3.5 w-3.5" />
											Verrouiller
										</button>
									)}
									<button
										onClick={() => handleDelete(selected)}
										className="h-9 px-4 rounded-full bg-red-50 text-red-700 text-[12px] font-semibold hover:bg-red-100 transition inline-flex items-center gap-1.5"
									>
										<Trash2 className="h-3.5 w-3.5" />
										Supprimer
									</button>
								</div>
							</div>

							{/* Messages */}
							<div
								ref={messagesContainerRef}
								className="flex-1 overflow-y-auto p-5 space-y-3 bg-baume-ivory/30"
							>
								{messages.map((msg) => (
									<div
										key={msg.id}
										className={`flex ${
											msg.sender_role === "admin"
												? "justify-end"
												: "justify-start"
										}`}
									>
										<div
											className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
												msg.sender_role === "admin"
													? "bg-baume-burgundy text-baume-white rounded-br-sm"
													: "bg-baume-white border border-baume-border text-baume-charcoal rounded-bl-sm"
											}`}
										>
											{msg.sender_role === "customer" && (
												<p className="text-[10px] font-semibold text-baume-burgundy mb-0.5">
													Client
												</p>
											)}
											<p className="text-[13px] leading-[1.5] whitespace-pre-wrap">
												{msg.content}
											</p>
											<p
												className={`text-[10px] mt-1 ${
													msg.sender_role === "admin"
														? "text-baume-white/60"
														: "text-baume-charcoal/40"
												}`}
											>
												{new Date(msg.created_at).toLocaleTimeString("fr-CH", {
													hour: "2-digit",
													minute: "2-digit",
												})}
												{msg.read_at && msg.sender_role === "admin" && (
													<span className="ml-1">· Lu</span>
												)}
											</p>
										</div>
									</div>
								))}
								{isCustomerTyping && (
									<div className="flex justify-start">
										<div className="bg-baume-white border border-baume-border rounded-2xl rounded-bl-sm px-4 py-2.5">
											<p className="text-[10px] font-semibold text-baume-burgundy mb-0.5">
												Client
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

							{/* Input admin */}
							{selected.status === "locked" ? (
								<div className="px-5 py-4 border-t border-baume-border bg-baume-ivory/50 flex items-center gap-2 shrink-0">
									<Lock className="h-4 w-4 text-baume-charcoal/40" />
									<p className="text-[12px] text-baume-charcoal/50">
										Conversation verrouillée — déverrouillez pour répondre.
									</p>
								</div>
							) : (
								<div className="px-4 py-3 border-t border-baume-border bg-baume-white shrink-0">
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
											placeholder="Répondre au client…"
											rows={1}
											className="flex-1 resize-none rounded-2xl border border-baume-border bg-baume-ivory px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-baume-taupe max-h-24"
										/>
										<button
											onClick={handleSend}
											disabled={!input.trim() || sending}
											className="h-10 w-10 rounded-full bg-baume-burgundy text-baume-white flex items-center justify-center hover:bg-baume-burgundyDark disabled:opacity-50 transition shrink-0"
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
						</>
					)}
				</div>
			</div>
		</div>
	);
}

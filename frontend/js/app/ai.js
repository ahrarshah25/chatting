console.log("AI JS Connected!");

document.getElementById("sendBtn").addEventListener("click", async () => {
    const textEl = document.getElementById("messageTextarea");
    const message = textEl.value.trim();
    if (!message) return;

    textEl.value = "";

    // Show user message
    window.appendMessage({
        sender_id: "USER",
        message_text: message,
        created_at: new Date()
    });

    // Save to DB
    await supabase.from("messages").insert({
        sender_id: "USER",
        receiver_id: "AI_ASSISTANT",
        message_text: message
    });

    // Show typing animation
    const typingEl = document.getElementById("typingIndicator");
    typingEl.style.display = "block";

    try {
        const url = `https://ahrarshah-api.vercel.app/api/ai?prompt=${encodeURIComponent(message)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("API ERROR");

        const data = await response.json();

        typingEl.style.display = "none";

        // Save AI reply
        await supabase.from("messages").insert({
            sender_id: "AI_ASSISTANT",
            receiver_id: "USER",
            message_text: data.result
        });

        // Show AI reply on UI
        window.appendMessage({
            sender_id: "AI_ASSISTANT",
            message_text: data.result,
            created_at: new Date()
        });

    } catch (err) {
        typingEl.style.display = "none";
        window.appendMessage({
            sender_id: "AI_ASSISTANT",
            message_text: "Sorry, I could not process that.",
            created_at: new Date()
        });
    }
});

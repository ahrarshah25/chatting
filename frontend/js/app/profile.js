import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://dgiaeetuqokpditcnddl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWFlZXR1cW9rcGRpdGNuZGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTQ1MDAsImV4cCI6MjA3OTYzMDUwMH0.LL3JyARBps_34SQUflWksG2plDyHCpA6oZnacUY76l0";
const BACKEND = "http://localhost:5000";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const avatarInput = document.getElementById("avatarInput");
const uploadBtn = document.getElementById("uploadBtn");
const removeBtn = document.getElementById("removeBtn");
const currentAvatar = document.getElementById("currentAvatar");
const avatarPlaceholder = document.getElementById("avatarPlaceholder");
const fullNameInput = document.getElementById("fullName");
const usernameInput = document.getElementById("username");
const checkUsernameBtn = document.getElementById("checkUsername");
const personalForm = document.getElementById("personalForm");
const successToast = document.getElementById("successToast");
const closeToast = document.getElementById("closeToast");
const pushToggle = document.getElementById("pushNotifications");

let currentUser = null;
let profileId = null;

async function init() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('init: no authenticated user');
            return;
        }
        currentUser = user;
        profileId = user.id;
        const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", profileId).single();
        if (error) {
            console.error('init: profile fetch error', error);
        }
        if (!profile) {
            console.log('init: no profile record found for', profileId);
        } else {
            fullNameInput.value = profile.name || "";
            usernameInput.value = profile.username || "";
            if (profile.avatar_url) {
                const urlResp = supabase.storage.from("profiles").getPublicUrl(profile.avatar_url);
                if (urlResp && urlResp.data && urlResp.data.publicUrl) {
                    currentAvatar.src = urlResp.data.publicUrl;
                    currentAvatar.style.display = "block";
                    avatarPlaceholder.style.display = "none";
                } else {
                    console.log('init: avatar public url not found');
                }
            }
        }
        await checkPushState();
    } catch (err) {
        console.error('init error', err);
    }
}
init();

uploadBtn.addEventListener("click", () => {
    try {
        avatarInput.click();
    } catch (err) {
        console.error('uploadBtn click error', err);
    }
});

avatarInput.addEventListener("change", async (e) => {
    try {
        const file = e.target.files[0];
        if (!file) {
            console.log('avatarInput: no file selected');
            return;
        }
        if (!profileId) {
            console.log('avatarInput: no profileId');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showToast("Error", "File size must be less than 2MB");
            return;
        }
        const ext = file.name.split('.').pop();
        const fileName = `${profileId}.${ext}`;
        const removal = await supabase.storage.from("profiles").remove([fileName]);
        if (removal && removal.error) {
            console.log('avatar remove warning', removal.error);
        }
        const { data, error } = await supabase.storage.from("profiles").upload(fileName, file, { upsert: true });
        if (error) {
            console.error('avatar upload error', error);
            return showToast("Error", "Upload failed");
        }
        const urlData = supabase.storage.from("profiles").getPublicUrl(fileName);
        const publicUrl = urlData && urlData.data && urlData.data.publicUrl ? urlData.data.publicUrl : null;
        if (!publicUrl) {
            console.log('avatar public url missing after upload');
            return showToast("Error", "Upload succeeded but URL missing");
        }
        currentAvatar.src = publicUrl;
        currentAvatar.style.display = "block";
        avatarPlaceholder.style.display = "none";
        const { error: updateErr } = await supabase.from("profiles").update({ avatar_url: fileName }).eq("id", profileId);
        if (updateErr) {
            console.error('profiles update avatar_url error', updateErr);
        }
        showToast("Success", "Profile picture updated");
    } catch (err) {
        console.error('avatarInput change error', err);
    }
});

removeBtn.addEventListener("click", async () => {
    try {
        if (!profileId) {
            console.log('removeBtn: no profileId');
            return;
        }
        currentAvatar.src = "";
        currentAvatar.style.display = "none";
        avatarPlaceholder.style.display = "flex";
        avatarInput.value = "";
        const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", profileId);
        if (error) {
            console.error('remove avatar update error', error);
        }
        showToast("Success", "Profile picture removed");
    } catch (err) {
        console.error('removeBtn error', err);
    }
});

checkUsernameBtn.addEventListener("click", async () => {
    try {
        const username = usernameInput.value.trim();
        if (!username) {
            console.log('checkUsername: empty username');
            return;
        }
        checkUsernameBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        checkUsernameBtn.disabled = true;
        const { data, error } = await supabase.from("profiles").select("id").eq("username", username);
        if (error) {
            console.error('checkUsername query error', error);
            showToast("Error", "Check failed");
        } else {
            if (data && data.length > 0 && data[0].id !== profileId) {
                showToast("Error", "Username already taken");
            } else {
                showToast("Success", "Username available");
            }
        }
    } catch (err) {
        console.error('checkUsername error', err);
    } finally {
        checkUsernameBtn.innerHTML = '<i class="fas fa-check"></i> Check Availability';
        checkUsernameBtn.disabled = false;
    }
});

personalForm.addEventListener("submit", async (e) => {
    try {
        e.preventDefault();
        const name = fullNameInput.value.trim();
        const username = usernameInput.value.trim();
        if (!name || !username) {
            showToast("Error", "Name and username required");
            return;
        }
        const { data, error } = await supabase.from("profiles").select("id").eq("username", username);
        if (error) {
            console.error('username check before save error', error);
            showToast("Error", "Save failed");
            return;
        }
        if (data && data.length > 0 && data[0].id !== profileId) {
            showToast("Error", "Username already taken");
            return;
        }
        const { error: updateErr } = await supabase.from("profiles").update({ name, username }).eq("id", profileId);
        if (updateErr) {
            console.error('profiles update error', updateErr);
            showToast("Error", "Update failed");
            return;
        }
        showToast("Success", "Profile updated");
    } catch (err) {
        console.error('personalForm submit error', err);
        showToast("Error", "Unexpected error");
    }
});

closeToast.addEventListener("click", () => {
    try {
        successToast.style.opacity = "0";
        successToast.style.transform = "translateY(-20px)";
        setTimeout(() => successToast.style.display = "none", 300);
    } catch (err) {
        console.error('closeToast error', err);
    }
});

function showToast(title, message) {
    try {
        const h = successToast.querySelector("h4");
        const p = successToast.querySelector("p");
        if (!h || !p) {
            console.log('showToast: toast elements missing');
            return;
        }
        h.textContent = title;
        p.textContent = message;
        successToast.style.display = "flex";
        setTimeout(() => {
            successToast.style.opacity = "1";
            successToast.style.transform = "translateY(0)";
        }, 50);
        setTimeout(() => {
            successToast.style.opacity = "0";
            successToast.style.transform = "translateY(-20px)";
        }, 3000);
        setTimeout(() => successToast.style.display = "none", 3400);
    } catch (err) {
        console.error('showToast error', err);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
    return output;
}

async function registerSWAndSubscribe() {
    try {
        if (!("serviceWorker" in navigator)) {
            console.log('registerSWAndSubscribe: serviceWorker not supported');
            return false;
        }
        if (!("PushManager" in window)) {
            console.log('registerSWAndSubscribe: PushManager not supported');
            return false;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (!reg) {
            console.log('registerSWAndSubscribe: registration failed');
            return false;
        }
        const cfg = await fetch(`${BACKEND}/config`).then(r => r.json()).catch(err => {
            console.error('registerSWAndSubscribe: config fetch error', err);
            return null;
        });
        if (!cfg || !cfg.publicVapidKey) {
            console.log('registerSWAndSubscribe: publicVapidKey missing');
            return false;
        }
        const publicKey = cfg.publicVapidKey;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
        if (!sub) {
            console.log('registerSWAndSubscribe: subscription failed');
            return false;
        }
        await fetch(`${BACKEND}/save-subscription`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: sub, userId: profileId })
        });
        return true;
    } catch (err) {
        console.error('registerSWAndSubscribe error', err);
        return false;
    }
}

async function unsubscribe() {
    try {
        if (!("serviceWorker" in navigator)) {
            console.log('unsubscribe: serviceWorker not supported');
            return false;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
            console.log('unsubscribe: no registration');
            return false;
        }
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
            console.log('unsubscribe: no subscription');
            return false;
        }
        await fetch(`${BACKEND}/unsubscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint })
        });
        const unsubbed = await sub.unsubscribe();
        if (!unsubbed) {
            console.log('unsubscribe: browser unsubscribe returned false');
        }
        return true;
    } catch (err) {
        console.error('unsubscribe error', err);
        return false;
    }
}

async function checkPushState() {
    try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            pushToggle.checked = false;
            pushToggle.disabled = true;
            return;
        }
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
            pushToggle.checked = false;
            return;
        }
        const sub = await reg.pushManager.getSubscription();
        pushToggle.checked = !!sub;
    } catch (err) {
        console.error('checkPushState error', err);
        pushToggle.checked = false;
    }
}

pushToggle.addEventListener("change", async () => {
    try {
        if (pushToggle.checked) {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") {
                console.log('pushToggle: permission denied');
                pushToggle.checked = false;
                showToast("Error", "Notification permission denied");
                return;
            }
            const ok = await registerSWAndSubscribe();
            if (!ok) {
                pushToggle.checked = false;
                showToast("Error", "Subscription failed");
                return;
            }
            showToast("Success", "Push notifications enabled");
        } else {
            const ok = await unsubscribe();
            if (!ok) {
                pushToggle.checked = true;
                showToast("Error", "Unsubscribe failed");
                return;
            }
            showToast("Success", "Push notifications disabled");
        }
    } catch (err) {
        console.error('pushToggle change handler error', err);
        pushToggle.checked = false;
    }
});

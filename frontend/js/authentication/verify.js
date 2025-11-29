import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://dgiaeetuqokpditcnddl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWFlZXR1cW9rcGRpdGNuZGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTQ1MDAsImV4cCI6MjA3OTYzMDUwMH0.LL3JyARBps_34SQUflWksG2plDyHCpA6oZnacUY76l0';
const supabase = createClient(supabaseUrl, supabaseKey);

const otpInputs = document.querySelectorAll('.otp-input');
const verifyForm = document.querySelector('.verify-form');
const successAlert = document.getElementById('successAlert');
const errorAlert = document.getElementById('errorAlert');

function getUserIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('user');
}

function getEnteredOTP() {
    return Array.from(otpInputs).map(input => input.value).join('');
}

function showAlert(alertElement) {
    alertElement.style.display = 'flex';
    setTimeout(() => alertElement.style.display = 'none', 3000);
}
otpInputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
        if(input.value.length === 1 && idx < otpInputs.length - 1) {
            otpInputs[idx + 1].focus();
        }
    });
});

verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enteredOTP = getEnteredOTP();
    const userId = getUserIdFromURL();

    if(!enteredOTP || enteredOTP.length !== 4) {
        showAlert(errorAlert);
        return;
    }

    const { data: otpData, error } = await supabase
        .from('otp_codes')
        .select('code')
        .eq('id', userId)
        .single();

    if(error || !otpData) {
        showAlert(errorAlert);
        return;
    }

    if(otpData.code === enteredOTP) {
        await supabase
            .from('otp_codes')
            .delete()
            .eq('id', userId);

        showAlert(successAlert);
        setTimeout(() => window.location.href = '/login', 2000);
    } else {
        showAlert(errorAlert);
    }
});

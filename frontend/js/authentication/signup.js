console.log("JS Coneted - Signup Page Via Supabase Authentication!");

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import emailjs from 'https://cdn.jsdelivr.net/npm/emailjs-com@3.2.0/+esm'

const supabaseUrl = 'https://dgiaeetuqokpditcnddl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWFlZXR1cW9rcGRpdGNuZGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTQ1MDAsImV4cCI6MjA3OTYzMDUwMH0.LL3JyARBps_34SQUflWksG2plDyHCpA6oZnacUY76l0';
const supabase = createClient(supabaseUrl, supabaseKey);

emailjs.init('irJn2J3oWn-KthFuO');

function removeErrorAlert(){
    setInterval(function(){
        errorAlert.style.display = "none"
    }, 3000)
}

async function userSignup(){
    let userName = document.getElementById("userName").value.trim();
    let userAccountName = document.getElementById("userAccountName").value.trim();
    let userEmail = document.getElementById("userEmail").value.trim();
    let userPassword = document.getElementById("userPassword").value.trim();
    let confirmPassword = document.getElementById("confirmPassword").value.trim();
    let successAlert = document.getElementById("successAlert");
    let successMessage = document.getElementById("successMessage");
    let errorAlert = document.getElementById("errorAlert");
    let errorMessage = document.getElementById("errorMessage");
    let regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(!userName || !userAccountName || !userEmail || !userPassword || !confirmPassword){
        errorAlert.style.display = "flex";
        errorMessage.textContent = "Please Fill All The Fields!";
        removeErrorAlert();
        setInterval(function(){
            window.location.reload();
        }, 3500)
        return;
    }
    if(!regex.test(userEmail)){
        errorAlert.style.display = "flex";
        errorMessage.textContent = "Please Enter Email In Correct Syntax\nFor Example: name@domain.com";
        removeErrorAlert();
        return;
    }else if(userPassword < 8){
        errorAlert.style.display = "flex";
        errorMessage.textContent = "Password Must Contain 8 Characters";
        removeErrorAlert();
        setInterval(function(){
            window.location.reload();
        }, 3500)
        return;
    }else if(userPassword !== confirmPassword){
        errorAlert.style.display = "flex";
        errorMessage.textContent = "Enter Same Password In Confirm Password Section";
        removeErrorAlert();
        setInterval(function(){
            window.location.reload();
        }, 3500)
        return;
    }
    const apiUri = `https://api.apilayer.com/email_verification/${userEmail}`;

    const option = {
        method: "Get",
        headers: {
            "apiKey": "N2eYdpoV5D3TaTNDaIzxSKStMXYTl8CU"
        }
    };
    try{
        const response = await fetch(apiUri, option)
        if(!response.ok){
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }
        const data = await response.json();
        const isDeliverable = data.is_deliverable;
        const isSyntaxValid = data.syntax_valid;

        if(isSyntaxValid && isDeliverable){
            const signupBtn = document.getElementById("signupBtn");
            signupBtn.textContent = "Creating Your Account!"
        }

    }catch (error){
        errorAlert.style.display = "flex";
        errorMessage.textContent = "Please Enter Valid Email Address That Exists!";
        removeErrorAlert();
        setInterval(function(){
            window.location.reload();
        }, 3500)
        return;
    }

    const {data: signupData, error: signupError} = await supabase.auth.signUp({
        email: userEmail,
        password: userPassword,
        options: {
            data: {
                username: userName,
                accountName: userAccountName
            }
        }
    });

    if(signupError){
        errorAlert.style.display = "flex";
        errorMessage.textContent = "Error: " + signupError.message;
        setInterval(function(){
            window.location.reload();
        }, 3500)
    }
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    await supabase.from('otp_codes').upsert({ id: signupData.user.id, code: otp });
    await emailjs.send('service_0gsyrob', 'template_smapi4s', {
        to_email: userEmail,
        passcode: otp,
        time: '15 minutes'
    });
    successAlert.style.display = "flex";
    successMessage.textContent = "Account Created Successfully. Now Login In To Your Account!";
    
    window.location.href = 'verify?user=' + signupData.user.id
}



let signupBtn = document.getElementById("signupBtn");
signupBtn.addEventListener("click" , function(e){
    e.preventDefault();
    let key = e.keyCode || e.which;
    if(key === 13){
        userSignup();
        return;
    }
    userSignup();
})

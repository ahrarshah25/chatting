console.log("JS Coneted - Login Page Via Supabase Authentication!");

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://dgiaeetuqokpditcnddl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnaWFlZXR1cW9rcGRpdGNuZGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNTQ1MDAsImV4cCI6MjA3OTYzMDUwMH0.LL3JyARBps_34SQUflWksG2plDyHCpA6oZnacUY76l0';
const supabase = createClient(supabaseUrl, supabaseKey);

function removeErrorAlert(){
    setInterval(function(){
        errorAlert.style.display = "none"
    }, 3000)
}

async function userLogin(){
    let userEmail = document.getElementById("userEmail");
    let userPassword = document.getElementById("userPassword");
    let successAlert = document.getElementById("successAlert");
    let successMessage = document.getElementById("successMessage");
    let errorAlert = document.getElementById("errorAlert");
    let errorMessage = document.getElementById("errorMessage");
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(!userEmail.value.trim() || !userPassword.value.trim()){
        errorAlert.style.display = "flex";
        errorMessage.textContent = "Please Fill All The Fields!";
        removeErrorAlert();
        userEmail.value = "";
        userPassword.value = "";
        return;
    }else if(!regex.test(userEmail.value)){
        errorAlert.style.display = "flex";
        errorMessage.textContent = "Please Enter Email In Correct Syntax\nFor Example: name@domain.com";
        removeErrorAlert();
        userEmail.value = "";
        userPassword.value = "";
        return;
    };

    const {data: loginData, error: loginError} = await supabase.auth.signInWithPassword({
        email: userEmail.value,
        password: userPassword.value
    });
    if(loginError){
        errorAlert.style.display = "flex";
        errorMessage.textContent = "Login Error: " + loginError.message;
    }
    successAlert.style.display = "flex";
    window.location.href = "/chat"
}

const loginBtn = document.getElementById("loginBtn");
loginBtn.addEventListener("click" , function(e){
    e.preventDefault();
    const key = e.keyCode || e.which;
    if(key === 13){
        userLogin();
        return;
    }
    userLogin();
});
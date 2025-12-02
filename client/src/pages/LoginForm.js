import React, { useState } from "react";
import Auth from "../utils/auth";
import { useForm } from "react-hook-form";
import { useMutation } from "@apollo/client";
import { SYNC_USER } from "../utils/mutations";
import { Navigate } from "react-router-dom";
import { signIn } from 'aws-amplify/auth';

import SignUpForm from "./SignUpForm";

const LoginForm = () => {
  const { register, handleSubmit, formState: {errors} } = useForm();
  const [syncUser] = useMutation(SYNC_USER);
  const [isHover, setIsHover] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [loginError, setLoginError] = useState('');

  const [showSignUp, setShowSignUp] = useState(false);

  function handleSignUp() {
    setShowSignUp(true);
  }

  function handleLogin() {
    setShowSignUp(false);
  }

  const loginSubmit = async (formData, event) => {
    event.preventDefault();
    setLoginError('');

    try {
      // Sign in with Cognito
      const { isSignedIn, nextStep } = await signIn({
        username: formData.email,
        password: formData.password,
      });

      if (isSignedIn) {
        // Get the ID token from the current session
        const { tokens } = await import('aws-amplify/auth').then(m => m.fetchAuthSession());
        const idToken = tokens.idToken.toString();

        // Sync user with backend (creates profile if needed)
        await syncUser({
          variables: { firstName: tokens.idToken.payload.given_name || formData.email.split('@')[0] }
        });

        // Store token and redirect
        Auth.login(idToken);
      } else {
        console.log('Next step:', nextStep);
        setLoginError('Please complete additional sign-in steps.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError(err.message || 'Failed to sign in. Please check your credentials.');
    }
  };

  const body = document.querySelector('body');
  body.style.margin = 0;

  const styles = {
    button: {
      border: "none",
      backgroundColor: "transparent",
      color: "white",
      padding: "10px",
      margin: "10px",
      width: "50%",
      cursor: "pointer",
      transition: "background-color 0.3s ease-in-out",
      minWidth: "150px",
    },
    activeButton: {
      border: "2px solid white",
      borderRadius: "50px",
      backgroundColor: "#623cff",
      color: "#fff",
    },
  };

  return (
    <div className="formContainer loginSignup">
      {Auth.loggedIn() && <Navigate to="/profile" />}

      <h1>Ghostbusters</h1>

      <div className="signupLogin">
        <button
          style={{
            ...styles.button,
            ...(activeTab === "signup" && styles.activeButton),
          }}
          onClick={() => {
            setActiveTab("signup");
            handleSignUp();
          }}
        >
          <h3>Sign Up</h3>
        </button>

        <button
          style={{
            ...styles.button,
            ...(activeTab === "login" && styles.activeButton),
          }}
          onClick={() => {
            setActiveTab("login");
            handleLogin();
          }}
        >
          <h3>Log In</h3>
        </button>
      </div>

      {showSignUp ? (
        <SignUpForm />
      ) : (
        <>
          <form onSubmit={handleSubmit(loginSubmit)}>
            {loginError && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{loginError}</div>}

            <input
              className='loginInput'
              {...register("email", {
                pattern: /^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/,
                required: true,
              })}
              placeholder="Email Address"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit(loginSubmit)()}
            />
            {errors.email && <small className='loginSmall'>This field is required</small>}

            <input
              className='loginInput'
              type="password"
              {...register("password", {required: true})}
              placeholder="Password"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit(loginSubmit)()}
            />
            {errors.password && <small className='loginSmall'>This field is required</small>}

            <button
              type="submit"
              onMouseEnter={() => setIsHover(true)}
              onMouseLeave={() => setIsHover(false)}
            >
              <h5>Log In</h5>
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default LoginForm;
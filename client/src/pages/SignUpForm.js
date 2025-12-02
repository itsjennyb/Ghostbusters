import React, { useState } from "react";
import Auth from "../utils/auth";
import { useForm } from "react-hook-form";
import { useMutation } from "@apollo/client";
import { SYNC_USER } from "../utils/mutations";
import { Navigate, useNavigate } from "react-router-dom";
import { signUp, signIn, confirmSignUp } from 'aws-amplify/auth';

const SignUpForm = () => {
  const { register, handleSubmit, formState: {errors} } = useForm();
  const [syncUser] = useMutation(SYNC_USER);
  const [isHover, setIsHover] = useState(false);
  const [activeTab, setActiveTab] = useState("signup");
  const [signupError, setSignupError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const navigate = useNavigate();

  const onSubmit = async (formData) => {
    setSignupError('');

    try {
      const firstName = uppercaseName(formData.firstName);

      // Sign up with Cognito
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username: formData.email,
        password: formData.password,
        options: {
          userAttributes: {
            email: formData.email,
            given_name: firstName,
          },
        },
      });

      // Store credentials for after verification
      setUserEmail(formData.email);
      setUserPassword(formData.password);
      setUserFirstName(firstName);

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setNeedsVerification(true);
        setSignupError('Please check your email for a verification code.');
      } else if (isSignUpComplete) {
        // Auto sign in and sync
        await handleSignInAndSync(formData.email, formData.password, firstName);
      }
    } catch (err) {
      console.error('Signup error:', err);
      setSignupError(err.message || 'Failed to sign up. Please try again.');
    }
  };

  const handleVerification = async (e) => {
    e.preventDefault();
    setSignupError('');

    try {
      await confirmSignUp({
        username: userEmail,
        confirmationCode: verificationCode,
      });

      // Sign in and sync after successful verification
      await handleSignInAndSync(userEmail, userPassword, userFirstName);
    } catch (err) {
      console.error('Verification error:', err);
      setSignupError(err.message || 'Failed to verify code. Please try again.');
    }
  };

  const handleSignInAndSync = async (email, password, firstName) => {
    try {
      const { isSignedIn } = await signIn({
        username: email,
        password: password,
      });

      if (isSignedIn) {
        const { tokens } = await import('aws-amplify/auth').then(m => m.fetchAuthSession());
        const idToken = tokens.idToken.toString();

        // Sync user with backend
        await syncUser({
          variables: { firstName }
        });

        // Store token and redirect to create profile
        localStorage.setItem('id_token', idToken);
        navigate('/createprofile');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setSignupError('Account created but failed to sign in. Please try logging in.');
    }
  };

  const uppercaseName = (name) => {
    let firstName = name.split('');
    let firstLetter = firstName[0].toUpperCase();
    firstName.splice(0, 1, firstLetter);
	  firstName = firstName.join('')
    return firstName;
}

  return (
    <>
      {needsVerification ? (
        <form onSubmit={handleVerification}>
          {signupError && <div className="error-message" style={{color: signupError.includes('check your email') ? 'green' : 'red', marginBottom: '10px'}}>{signupError}</div>}

          <p style={{color: 'white', marginBottom: '10px'}}>Enter the verification code sent to your email:</p>

          <input
            className='loginInput'
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="Verification Code"
            required
          />

          <button
            type="submit"
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
          >
            <h5>Verify Email</h5>
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          {signupError && !signupError.includes('check your email') && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{signupError}</div>}

          <input
            className='loginInput'
            {...register("firstName", {required:true})}
            placeholder="First Name"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(onSubmit)()}
          />
          {errors.firstName && <small className='loginSmall'>This field is required</small>}

          <input
            className='loginInput'
            {...register("email", {
              pattern: /^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/,
              required: true,
            })}
            placeholder="Email"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(onSubmit)()}
          />
          {errors.email && <small className='loginSmall'>This field is required</small>}

          <input
            className='loginInput'
            type="password"
            {...register("password", {required: true, minLength: 8})}
            placeholder="Password (min 8 characters)"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(onSubmit)()}
          />
          {errors.password && <small className='loginSmall'>Password must be at least 8 characters</small>}

          <button
            type="submit"
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
          >
            <h5>Sign Up</h5>
          </button>
        </form>
      )}
    </>
  );
};

export default SignUpForm;
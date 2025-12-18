import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';

const ForgotPassword = () => {
  const { register, handleSubmit, formState: {errors} } = useForm();
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // 'email' or 'reset'
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isHover, setIsHover] = useState(false);

  // Step 1: Request password reset
  const handleEmailSubmit = async (formData) => {
    setError('');
    setSuccess('');

    try {
      const output = await resetPassword({ username: formData.email });

      setEmail(formData.email);
      setStep('reset');
      setSuccess('Verification code sent to your email!');

      console.log('Reset password output:', output);
    } catch (err) {
      console.error('Reset password error:', err);
      setError(err.message || 'Failed to send reset code. Please try again.');
    }
  };

  // Step 2: Confirm password reset with code and new password
  const handleResetSubmit = async (formData) => {
    setError('');
    setSuccess('');

    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: formData.code.trim(),
        newPassword: formData.newPassword,
      });

      setSuccess('Password reset successfully! Redirecting to login...');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error('Confirm reset error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    }
  };

  const body = document.querySelector('body');
  body.style.margin = 0;

  return (
    <div className="formContainer loginSignup">
      <h1>Ghostbusters</h1>
      <h2 style={{ color: 'white', marginBottom: '20px' }}>Reset Password</h2>

      {step === 'email' ? (
        <form onSubmit={handleSubmit(handleEmailSubmit)}>
          {error && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
          {success && <div className="success-message" style={{color: 'green', marginBottom: '10px'}}>{success}</div>}

          <p style={{color: 'white', marginBottom: '10px', fontSize: '14px'}}>
            Enter your email address and we'll send you a verification code to reset your password.
          </p>

          <input
            className='loginInput'
            {...register("email", {
              pattern: /^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/,
              required: true,
            })}
            placeholder="Email Address"
          />
          {errors.email && <small className='loginSmall'>Please enter a valid email</small>}

          <button
            type="submit"
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
          >
            <h5>Send Reset Code</h5>
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid white',
              marginTop: '10px'
            }}
          >
            <h5>Back to Login</h5>
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit(handleResetSubmit)}>
          {error && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
          {success && <div className="success-message" style={{color: 'green', marginBottom: '10px'}}>{success}</div>}

          <p style={{color: 'white', marginBottom: '10px', fontSize: '14px'}}>
            Enter the verification code sent to <strong>{email}</strong> and your new password.
          </p>

          <input
            className='loginInput'
            {...register("code", {required: true})}
            placeholder="Verification Code"
          />
          {errors.code && <small className='loginSmall'>Verification code is required</small>}

          <input
            className='loginInput'
            type="password"
            {...register("newPassword", {required: true, minLength: 8})}
            placeholder="New Password (min 8 characters)"
          />
          {errors.newPassword && <small className='loginSmall'>Password must be at least 8 characters</small>}

          <input
            className='loginInput'
            type="password"
            {...register("confirmPassword", {
              required: true,
              validate: (value, formValues) => value === formValues.newPassword
            })}
            placeholder="Confirm New Password"
          />
          {errors.confirmPassword && <small className='loginSmall'>Passwords must match</small>}

          <button
            type="submit"
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
          >
            <h5>Reset Password</h5>
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('email');
              setError('');
              setSuccess('');
            }}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid white',
              marginTop: '10px'
            }}
          >
            <h5>Resend Code</h5>
          </button>
        </form>
      )}
    </div>
  );
};

export default ForgotPassword;

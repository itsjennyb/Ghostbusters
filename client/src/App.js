import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ApolloClient, ApolloProvider, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { Amplify } from 'aws-amplify';
import awsConfig from './aws-config';
import './App.css';
import Explore from './pages/Explore'
import Login from './pages/LoginForm'
import SignUp from './pages/SignUpForm'
import ForgotPassword from './pages/ForgotPassword'
import Footer from './components/Footer'
import ProfileForm from './pages/CreateProfile'
import PreferencesForm from './pages/Preferences';
import Details from './pages/Details'
import Profile from './pages/Profile'
import Matches from './pages/Matches'
import EditProfile from './pages/EditProfile';
import EditPreferences from './pages/EditPreferences';
import Upload from './components/Upload'

// Configure Amplify
Amplify.configure(awsConfig);

// Normalise configuration for the GraphQL endpoint so the app can run from static hosting
const resolveGraphqlUri = () => {
  const directUri = (process.env.REACT_APP_GRAPHQL_URI || '').trim();
  if (directUri) {
    return directUri;
  }

  const backendBase = (
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_URL ||
    ''
  ).trim();

  const configuredPath = (process.env.REACT_APP_GRAPHQL_PATH || '/graphql').trim();
  const path = configuredPath ? configuredPath : '/graphql';

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalisedPath = path.startsWith('/') ? path : `/${path}`;

  if (backendBase) {
    const normalisedBase = backendBase.replace(/\/+$/, '');
    return `${normalisedBase}${normalisedPath}`;
  }

  return normalisedPath;
};

// SETTING UP THE HTTP LINK
const httpLink = createHttpLink({
  uri: resolveGraphqlUri(),
  useGETForQueries: false,
});

// SETTING UP THE CONTEXT
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('id_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// CREATING THE APOLLO CLIENT WITH THE HTTPLINK AND CONTEXT
const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

function App() {

  return (
    <ApolloProvider client={client}>
      <Router>
        <>
          <Routes>
            <Route
              exact path='/'
              element={<Login />}
            />
            <Route
              exact path='/explore'
              element={<Explore />}
            />
            <Route path='/login' element={<Login />} />
            <Route path='/signup' element={<SignUp />} />
            <Route path='/forgot-password' element={<ForgotPassword />} />
            <Route path='/createprofile' element={<ProfileForm />} />
            <Route path='/preferences' element={<PreferencesForm />} />
            <Route path='/details/:userId' element={<Details />} />
            <Route path='/profile' element={<Profile />} />
            <Route path='/upload' element={<Upload />} />
            <Route path='/matches' element={<Matches />} />
            <Route path='/editprofile' element={<EditProfile />} />
            <Route path='/editpreferences' element={<EditPreferences />} />
            <Route
              path='*'
              element={<h1 className='display-2'>Wrong page!</h1>}
            />
          </Routes>
        </>
      <Footer />
      </Router>
    </ApolloProvider>
  );
}

export default App;

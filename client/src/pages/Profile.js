import React from 'react';
import Auth from '../utils/auth';
import { useQuery } from '@apollo/client';
import { GET_ME } from '../utils/queries';
import Header from '../components/Header';
import ProfileCard from '../components/ProfileCard';
import { Link, Navigate } from 'react-router-dom';

const Profile = () => {

    const handleLogout = () => {
        Auth.logout();
    };

    const { loading, data, error } = useQuery(GET_ME, {
        fetchPolicy: 'cache-and-network',
        nextFetchPolicy: 'cache-first',
    });

    if (error) {
        return <div>Error! {error.message}</div>;
    }

    const me = data?.me;

    if (loading && !me) {
        return <div>Loading...</div>;
    }

    if (!loading && me && (!me.profile || !me.preference)) {
        return <Navigate to='/createprofile' replace />;
    }

    if (!me) {
        return <Navigate to='/login' replace />;
    }

    const profile = me.profile;
    const preference = me.preference;

    return (
        <>
        {!Auth.loggedIn() && <Navigate to='/login' />}
            <Header title="my profile" />
            <div className="exploreContainer formContainer">
                <div className="profileContainer">

                    <ProfileCard name={me.firstName} age={profile.age} gender={profile.gender} height={profile.height} work={profile.work} bio={profile.bio} religion={profile.religion} politics={profile.politics} smoking={profile.smoking} drinking={profile.drinking} image={me.image} />
                    <hr />

                    <h3 className="profilePreferencesTitle">Preferences</h3>
                    <div className="profilePreferences">
                        <h4>Age: {preference.minAge} to {preference.maxAge}</h4>
                        <h4>Height: {preference.minHeight} to {preference.maxHeight}</h4>
                        <h4>Religion: {preference.religion}</h4>
                        <h4>Politics: {preference.politics}</h4>
                        <h4>Smoking: {preference.smoking}</h4>
                        <h4>Drinking: {preference.drinking}</h4>
                    </div>
                    <div className="profileBtns">
                        <Link to='/editprofile'>
                            <button>Edit</button>
                        </Link>
                        <button onClick={handleLogout}>Logout</button>
                    </div>
                </div>
            </div>
        </>
    )
};

export default Profile;

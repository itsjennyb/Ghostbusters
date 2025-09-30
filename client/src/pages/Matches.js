import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_ME } from '../utils/queries';
import MatchCard from '../components/MatchCard';
import Header from '../components/Header';
import Auth from '../utils/auth';
import { Navigate } from 'react-router-dom';

const Matches = () => {

    const loggedIn = Auth.loggedIn();
    const { loading, data } = useQuery(GET_ME, {
        skip: !loggedIn,
    });

    if (!loggedIn) {
        return <Navigate to='/login' />;
    }

    if (loading) {
        return <div>Loading...</div>;
    }

    const me = data?.me || {};
    const matches = me.matches ?? [];

    const renderMatches = matches
        .map((match) => (typeof match === 'string' ? match : match?._id))
        .filter(Boolean);

    return (
        <div className='contentContainer'>
            <Header title="my matches" />
            <div className="matches">
                {renderMatches.length ? (
                    renderMatches.map((matchId) => (
                        <MatchCard key={matchId} userId={matchId} />
                    ))
                ) : (
                    <h4 className="noMatches">Sorry! No Matches Yet!</h4>
                )}

            </div>
        </div>
    );
};

export default Matches;

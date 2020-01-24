import { handleActions } from 'redux-actions';
import actions from '../actions';

export default handleActions({
    [actions.pluginUpdate]: (state, action) => {
        return { ...state, ...action.payload };
    },


    [actions.pluginReplace]: (state, action) => {
        return action.payload;
    },

}, {});

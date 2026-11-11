import {startApp} from './app/bootstrap';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';

startApp(document.getElementById('root'), {random: Math.random});

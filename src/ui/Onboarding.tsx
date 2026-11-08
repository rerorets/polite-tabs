import { APP_NAME } from '../shared/brand';
import { COLORS } from '../shared/colors';

const DEMO_TABS = [
  { title: 'Inbox - johndoe@gmail.com', icon: 'gmail-icon.png', grouped: true },
  { title: 'polite tabs extension - Google Search', icon: 'google-icon.png', grouped: false },
  { title: 'Home / Twitter', icon: 'twitter-logo.png', grouped: false },
];

interface Props {
  onConfirm: (withExamples: boolean) => void;
}

export const Onboarding = ({ onConfirm }: Props) => (
  <div className="onboarding">
    <p className="lead">
      {APP_NAME} は、URL のパターンでタブを自動で<span style={{ color: COLORS.blue }}>グループ</span>
      にまとめます。
    </p>

    <div className="demo-strip" aria-hidden="true">
      <span className="demo-group" style={{ background: COLORS.blue }}>
        mail
      </span>
      {DEMO_TABS.map((tab) => (
        <span
          key={tab.title}
          className={`demo-tab ${tab.grouped ? 'demo-tab--grouped' : ''}`}
          style={{ ['--group' as string]: COLORS.blue }}
        >
          <img src={`/${tab.icon}`} alt="" />
          <span>{tab.title}</span>
        </span>
      ))}
    </div>

    <div className="demo-rule" aria-hidden="true">
      <span className="swatch" style={{ background: COLORS.blue }} />
      <span className="demo-field">mail</span>
      <span className="demo-field demo-field--wide">mail.google.com</span>
    </div>

    <div className="onboarding-actions">
      <button type="button" className="button" onClick={() => onConfirm(false)}>
        空の状態ではじめる
      </button>
      <button type="button" className="button button--primary" onClick={() => onConfirm(true)}>
        例のルールではじめる
      </button>
    </div>
  </div>
);

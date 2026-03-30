import './ToggleSwitch.css';

export default function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle-switch${checked ? ' toggle-switch--on' : ''}${disabled ? ' toggle-switch--disabled' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    />
  );
}

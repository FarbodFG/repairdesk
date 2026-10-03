export function PhoneFallback() {
  return (
    <div className="phone-fallback" aria-hidden="true">
      <div className="phone-layer phone-back">
        <span className="camera one" />
        <span className="camera two" />
        <span className="camera three" />
        <span className="phone-brand">RD</span>
      </div>
      <div className="phone-layer phone-board">
        <span className="board-chip">
          RD
          <br />
          CORE
        </span>
        <span className="board-battery">
          <span>+</span>
          <b>
            POWER
            <br />
            MODULE
          </b>
          <small>Li-ion / rechargeable</small>
        </span>
        <i />
        <i />
        <i />
      </div>
      <div className="phone-layer phone-screen">
        <div className="speaker" />
        <div className="screen-cross">+</div>
        <div className="screen-lines">
          <span />
          <span />
          <span />
        </div>
        <span className="screen-caption">
          EVERY DETAIL
          <br />
          MATTERS.
        </span>
      </div>
    </div>
  )
}

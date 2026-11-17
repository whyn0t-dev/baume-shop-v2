import { forwardRef } from "react";

/**
 * Champ « pot de miel » anti-robots.
 * Invisible pour les visiteuses (hors écran, ignoré par les lecteurs d'écran et
 * la touche Tab). Les robots qui remplissent tous les champs le complètent :
 * le serveur reconnaît alors un envoi automatique et ne fait rien.
 */
const HoneypotField = forwardRef(function HoneypotField(_props, ref) {
	return (
		<div
			aria-hidden="true"
			style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
		>
			<label>
				Ne pas remplir ce champ
				<input ref={ref} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
			</label>
		</div>
	);
});

export default HoneypotField;

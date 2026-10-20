# Stellar-Conduct Mechanics & Mathematical Formulas

**Stellar-Conduct** is a specialized elemental reaction family that replaces standard Superconduct when a character possessing **Stellar Linchpin** or **Stellar Glimmer** attributes is present in the party.

Unlike traditional transformative reactions (such as Overloaded or standard Superconduct), the Stellar-Conduct reaction itself deals zero base damage upon trigger. Instead, it generates a field utility (**Polestar Field**) and enables a specialized damage category called **Direct Stellar-Conduct Damage**.

---

## 1. Direct Stellar-Conduct DMG Formula

Instances of damage explicitly classified as "Stellar-Conduct DMG" follow this specific output formula:

$$\text{Damage} = \text{Base DMG} \times \left( 1 + \text{DMG\%}_{\text{Stellar}} + \text{DMG\%}_{\text{EM}} \right) \times \text{Polestar Multiplier} \times \text{CRIT Multiplier} \times \text{Enemy DEF} \times \text{Enemy RES}$$

---

## 2. Breakdown of Formula Components

### A. Base DMG
Unlike transformative reactions that scale strictly off character level multipliers, Direct Stellar-Conduct DMG scales directly from character combat stats defined in their Talent descriptors (most frequently **ATK**, **HP**, or **DEF**):

$$\text{Base DMG} = \text{Talent Coefficient} \times \text{Scaling Stat}$$

---

### B. Elemental Mastery (EM) Conversion Bonus ($\text{DMG\%}_{\text{EM}}$)
Elemental Mastery does not act as an independent multiplicative layer for Stellar-Conduct. Instead, it maps directly onto the reaction's additive DMG% bonus bracket using a diminishing scaling curve:

$$\text{DMG\%}_{\text{EM}} = \frac{6 \times \text{EM}}{\text{EM} + 2000}$$

* **200 EM:** Yields a $+54.5\%$ DMG Bonus.
* **1000 EM:** Yields a $+200.0\%$ DMG Bonus to Direct Stellar-Conduct instances.

---

### C. Stellar DMG% Bracket ($\text{DMG\%}_{\text{Stellar}}$)
Generic Elemental DMG% (such as *Cryo DMG Bonus* or *Electro DMG Bonus*) does not increase Direct Stellar-Conduct instances. Only general All-DMG%, Stellar Glimmer DMG%, or explicit Stellar-Conduct DMG% bonuses sum into this additive term:

$$\text{Total Additive Bonus} = \text{DMG\%}_{\text{Stellar}} + \text{DMG\%}_{\text{EM}}$$

---

### D. Polestar Field Stack Multiplier ($\text{Polestar Multiplier}$)
The field tracks party elemental hits over a 4-second window. The total stack count ($N$, where $0 \le N \le 12$) determines the multiplier applied to Stellar-Conduct instances:

$$\text{Polestar Multiplier} = \begin{cases} 
1.00 & \text{if } N = 0 \\
1.40 + 0.05 \times N & \text{if } 1 \le N \le 12 
\end{cases}$$

* **0 Stacks:** $1.00\times$
* **1 Stack:** $1.45\times$
* **12 Stacks (Max):** $2.00\times$

---

### E. CRIT Multiplier
Unlike standard reaction flat damage, Direct Stellar-Conduct DMG can land critical hits using the character's active CRIT stats:

$$\text{CRIT Multiplier (Average)} = 1 + (\text{CRIT Rate} \times \text{CRIT DMG})$$

$$\text{CRIT Multiplier (On Hit)} = 1 + \text{CRIT DMG}$$

---

### F. Enemy DEF & RES Multipliers
Direct Stellar-Conduct DMG is subject to standard target mitigation calculations:

$$\text{DEF Multiplier} = \frac{\text{Level}_{\text{Char}} + 100}{(\text{Level}_{\text{Char}} + 100) + (\text{Level}_{\text{Enemy}} + 100) \times (1 - \text{DEF Reduction})}$$

$$\text{RES Multiplier} = 1 - \text{Enemy RES}_{\text{Type}}$$

*(Note: RES is determined by the element type assigned to the individual attack).*

---

## 3. Polestar Field Party Stat Buff Formula

In addition to enhancing Direct Stellar DMG, the active Polestar Field provides elemental DMG% buffs to all active party members based on recorded stacks ($N$):

$$\text{Party Cryo/Electro DMG Bonus} = 28\% + \min(N, 12) \times 1\%$$

* **0 Stacks:** $+28\%$ Cryo & Electro DMG Bonus
* **12 Stacks:** $+40\%$ Cryo & Electro DMG Bonus
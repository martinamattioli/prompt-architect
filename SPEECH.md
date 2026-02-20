# The ZERF Prompt Architect — Short Speech

**What it is**  
The ZERF Prompt Architect is our internal “Senior Brain in a box”: a lightweight web app that uses **meta-prompting** so we stop shipping generic, off-brand output. Instead of one-shot prompts like “Write a stepper,” the tool makes the AI act as a **Prompt Engineer** that **interviews** you first, then produces a clear, structured brief and the final deliverable.

---

**The problem it solves day to day**

- **Zero-shot prompts** from the team (e.g. “Build a stepper for Sandals”) lead to generic or buggy results that don’t follow our stack or our clients’ patterns.
- Juniors and busy leads don’t always spell out tech stack, edge cases, or audience, so we waste time in back-and-forth or rework.
- We don’t have a single place to reuse “golden” prompts that already worked for Sandals, PRIOR, or sales.

The Architect fixes that: **interview first, generate once**, with our context baked in and the option to **save winning prompts to the team library**.

---

**How it works (in practice)**

1. **Front Door**  
   You pick an area (Software, Management, Sales, Design), a project (or “No project” for ZERF-only work), and a short goal. Company comes from the project.

2. **Reverse prompting (the interview)**  
   The AI doesn’t generate anything yet. It asks **3–5 clarifying questions** (tech stack, state, accessibility, audience, length, examples) and structures the conversation around **CLEAR** (Context, Length, Examples, Audience, Role). If you upload a screenshot or Figma, it uses **vision** to talk about layout, colors, and spacing. For **mobile**, it nudges toward React Native and mobile best practices (safe area, touch targets, etc.).

3. **Requirements locked**  
   When enough is clear, the AI summarizes in a few sentences and says: *“Requirements locked. Generating assets.”* Only then do you hit **Generate assets**.

4. **Context injection**  
   Every prompt is grounded in **ZERF global context** (brand voice, hospitality audience) and, when you chose a project, that project’s **tech stack, brand voice, and architectural decisions**. So tickets and components match Sandals or PRIOR patterns without you rewriting the prompt.

5. **Design in the prompt**  
   If you attached an image, the tool uses **vision** to describe the design in technical terms (layout, colors, typography) and injects that into the final ticket or component prompt.

6. **Save to Library**  
   After you get a good result, you can **Save to Library** with a title. That creates a shared **Team Library** of “golden prompts” the whole team can browse (by project) and copy from, so we don’t reinvent the wheel.

---

**One sentence for daily use**  
*“It’s the tool where you describe what you need, the AI asks the right questions, then it generates the ticket, component, or post—using our context and patterns—and you can save the best ones to the team library.”*

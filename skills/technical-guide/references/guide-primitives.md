# Guide primitives

Every guide gives the reader these elements, explicitly or through clear context:

| Element | Reader question |
| --- | --- |
| Reader | Is this for me? What knowledge does it assume? |
| Goal | What will I understand or be able to do? |
| Scope | Which versions, conditions, and limits apply? |
| Explanation | How does this work? Why does this choice follow? |
| Evidence | What supports the claims and examples? |
| Understanding | How can I tell whether I understood or succeeded? |

A procedural guide also needs these elements:

| Element | Reader question |
| --- | --- |
| Prerequisites | Which tools, files, permissions, and starting state do I need? |
| Steps | What do I do next, and in which order? |
| Example | Are the commands, imports, filenames, and setup complete? |
| Expected result | What should happen, and what should I inspect? |
| Recovery | What likely failures can occur, and how do I recover? |

Adapt the check to the page's purpose. A reference page may use a precise lookup example.
An explanation may use a worked scenario or a question that tests the reader's mental model.
Neither needs a forced sequence of installation steps.
Do not invent rare failures or pad clear prose to fill the table.

Review heading-to-paragraph density in the rendered page.
Repeated headings with one short paragraph can break an explanation into disconnected fragments.
Merge divisions that merely restate the following sentence or split one continuous idea.
Keep headings that serve distinct reader questions, ordered steps, or reference lookup.
Code blocks, tables, and figures may justify sections with little prose.
Use density to locate review candidates, without a fixed ratio or automatic quality score.
Do not add filler paragraphs to change the ratio.
If removing a heading changes an anchor, check links and follow the destination's anchor conventions.

## Code and visuals

Use code to demonstrate behavior. Explain inputs, outputs, and relevant limitations beside it.
Use a diagram to explain relationships or a sequence that prose leaves hard to follow.
Its arrows, labels, and conditions must agree with the code and verified behavior.
Use a screenshot to show an observable state or a concrete interface action.
Explain what the screenshot proves and what it cannot prove.
Identify the captured version or environment when it affects the result.
Give images useful alternative text. State the important result in prose too.

Use actual captures. Never fabricate screenshots or imply a capture came from a different interface.
When capture is unavailable, provide explicit capture instructions or mark a draft placeholder.
Keep a screenshot of a demo log distinct from a screenshot of browser developer tools.
Code, screenshots, and diagrams are optional tools. Include each when it answers a reader question.

## Select primitives during the initial sweep

Separate the reader's needs above from the formats available in the destination.
A missing image does not remove the need to explain an observable result.

Inspect the destination, nearby examples, existing assets, codebase, tools, and permissions.
For a GitHub comment, check supported Markdown and asset links.
For a documentation site, check its components, diagram renderer, and asset conventions.
Do not assume that a format supported elsewhere works here.

Keep a small private inventory:

| Candidate | Record |
| --- | --- |
| Existing example, diagram, capture, or source | Location, reader question, freshness, and reuse limits |
| New primitive using existing support | Required code or capture, verification method, and authorization |
| Primitive requiring new support | Missing renderer, component, hosting, access, or fixture |
| Unavailable primitive | Constraint and a supported way to explain the same point |

Choose the smallest set that answers the reader's questions.
Use an existing primitive only when its evidence and context match this guide.
Do not add every available format or treat repository assets as proof of an unrelated example.

When a useful primitive needs creation, propose it before building it.
State its reader benefit, destination, required work, verification method, and cost or access needs.
Ask whether to build it or use a supported alternative.
Bundle related proposals into one decision. Continue work that does not depend on the answer.
If the request already authorizes that exact creation, proceed without asking again.
New components, dependencies, services, public uploads, and production changes require their own authorized scope.

Record the selected primitives and their verification limits in private working evidence.
Use those selections to plan the checks. Do not turn the inventory into mandatory published headings.

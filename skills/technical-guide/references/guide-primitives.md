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

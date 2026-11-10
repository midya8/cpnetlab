# Prior work and semantic boundaries

Checked November 9, 2026. CPNetLab implements a small exact inspector, not a new
preference formalism or algorithm. The following academic/teaching sources
were read directly. The developed controls are original synthetic examples;
they are not user studies, datasets or performance comparisons.

1. Boutilier, Brafman, Domshlak, Hoos and Poole, _CP-nets: A Tool for
   Representing and Reasoning with Conditional Ceteris Paribus Preference
   Statements_, JAIR, published February 1, 2004.
   https://jair.org/index.php/jair/article/view/10368
   Grounding: conditional ceteris-paribus semantics, dominance, ordering and
   optimal-outcome questions. Publisher metadata and abstract.
2. Boutilier, Brafman, Hoos and Poole, _Reasoning With Conditional Ceteris Paribus
   Preference Statements_, UAI 1999, author-hosted paper.
   https://www.cs.ubc.ca/~hoos/Publ/uai99.pdf
   Grounding: improving flips, comparison by flipping sequences, acyclic
   consistency and a two-variable cyclic matching example. CPNetLab's matching
   versus opposite-preference controls illustrate this established distinction.
3. Boutilier et al., _Preference-based Constrained Optimization with CP-nets_,
   author-hosted paper.
   https://www.cs.ubc.ca/~poole/papers/cpconstraints.pdf
   Grounding: dominance versus consistent ordering, incomparability, total
   conditional rows and improving sequences. CPNetLab does not implement the
   paper's constrained optimization algorithms or claim their complexity.
4. Goldsmith, Lang, Truszczynski and Wilson, _The computational complexity of
   dominance and consistency in CP-nets_, IJCAI 2005.
   https://ijcai.org/proceedings/2005/70
   Grounding: general dominance/consistency difficulty, improving cycles and
   graph reachability. The paper establishes PSPACE-completeness for general
   CP-nets; our 16-outcome enumeration does not solve that scaling problem.
5. Goldsmith, _CP-net Tutorial Syllabus_, University of Kentucky, undated.
   https://www.cs.uky.edu/~goldsmit/CPnetTutorial/
   Grounding: teaching context distinguishing dominance, preference graphs,
   learning, elicitation and multi-agent preference aggregation. Only the
   supplied-model finite reasoning branch is implemented here.
6. Brafman, _A New Look at the Semantics and Optimization Methods of CP-Networks_,
   IJCAI 2003.
   https://ijcai.org/proceedings/2003/0147.pdf
   Boundary: proposes extended semantics for some cyclic networks. CPNetLab
   deliberately does not implement this extension. A strict compatible total
   ranking is our explicit consistency contract; an improving cycle gives zero
   such rankings, not an empirical claim that preferences are meaningless.

High confidence in source identity and the used definitions. Historical
complexity/algorithm discussions are not treated as current software-availability
claims. Graph search, Floyd-Warshall, topological ordering and subset dynamic
programming are standard methods. Exact full-domain certificates and independent
reconstruction are implementation properties, not novel theoretical results.

7. Sharmi Dev Gupta, Begum Genc and Barry O'Sullivan, _Explanation in Constraint
   Satisfaction: A Survey_, IJCAI 2021.
   https://ijcai.org/proceedings/2021/601
   Grounding: setwise-minimal conflicts, minimal correction sets, maximal
   consistent relaxations and minimal hitting-set duality; minimal is different
   from minimum-cardinality. The full survey text was read. The row-subset
   atlas instantiates these established concepts for groups of whole supplied
   conditional-row constraints. It does not claim invention, implement the
   surveyed scalable solvers or imply that a mathematical explanation is an
   intuitive or desirable human preference revision.

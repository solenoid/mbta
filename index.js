import { render, Component, h } from "./web_modules/preact.js";
import htm from "./web_modules/htm.js";
// - https://www.pikapkg.com/blog/pika-web-a-future-without-webpack#pika-web-web-apps-without-the-bundler
// - https://www.npmjs.com/package/htm
const html = htm.bind(h);
class App extends Component {
  componentDidMount() {
    fetch("https://api-v3.mbta.com/routes?filter%5Btype%5D=0,1")
      .then(d => d.json())
      .then(({ data: routes }) => {
        this.setState({ routes });
        // TODO see if there is a better way to get stops instead of
        //      fanning out a fetch promise for each route
        const stopPromises = routes
          .map(r => r.id)
          .map(id =>
            fetch(`https://api-v3.mbta.com/stops?filter%5Broute%5D=${id}`)
              .then(d => d.json())
              .then(d => d.data),
          );
        Promise.all(stopPromises)
          .then(d => {
            const routesWithStops = routes.map((r, i) => {
              r.stops = d[i];
              r.stopCount = d[i].length;
              return r;
            });
            const stopCounts = routesWithStops.map(r => r.stopCount);
            const max = Math.max(...stopCounts);
            const min = Math.min(...stopCounts);
            const maxRoute = routesWithStops.find(d => d.stopCount === max).attributes.long_name;
            const minRoute = routesWithStops.find(d => d.stopCount === min).attributes.long_name;
            this.setState({ maxRoute, minRoute });
            const stopIndexed = routesWithStops.reduce((memo, r) => {
              r.stops.forEach(s => {
                // assume names are unique if not use ids instead
                const stopKey = s.attributes.name;
                memo[stopKey] = memo[stopKey] || [];
                memo[stopKey].push(r.attributes.long_name);
              });
              return memo;
            }, {});
            const multiRouteStops = Object.entries(stopIndexed).filter(([_, v]) => v.length > 1);
            this.setState({ multiRouteStops });
            const intersections = multiRouteStops.reduce((memo, [_, routes]) => {
              const stops = routes
                .map((r, i, l) => l.slice(i + 1).map(d => (r < d ? `${r}-${d}` : `${d}-${r}`)))
                .flat();
              stops.forEach(i => memo.add(i));
              return memo;
            }, new Set());
            const edgeList = Array.from(intersections);
            const routeFinder = (begin, end, path) => {
              const validRoutes = routes.map(d => d.attributes.long_name);
              if (validRoutes.indexOf(begin) === -1) {
                throw new Error(`Invalid begin route ${begin}`);
              }
              if (validRoutes.indexOf(end) === -1) {
                throw new Error(`Invalid begin route ${end}`);
              }
              if (begin === end) {
                return [begin];
              }
              const beginEdges = edgeList.filter(edge => edge.indexOf(begin) > -1);
              const beginEndConnected = beginEdges.some(edge => edge.indexOf(end) > -1);
              if (beginEndConnected) {
                return [begin, ...path, end];
              }
              const nextEdges = beginEdges
                .map(e => e.replace(begin, "").replace("-", ""))
                .filter(e => path.indexOf(e) === -1);
              for (const next of nextEdges) {
                return routeFinder(next, end, path.concat([begin]));
              }
            };
            const stopRouteFinder = (begin, end) => {
              const beginRoutes = stopIndexed[begin];
              if (!beginRoutes) {
                throw new Error(`Invalid begin stop ${begin}`);
              }
              const endRoutes = stopIndexed[end];
              if (!endRoutes) {
                throw new Error(`Invalid end stop ${end}`);
              }
              return routeFinder(beginRoutes[0], endRoutes[0], []);
            };
            this.setState({ intersections, stopRouteFinder });
          })
          .catch(e => {
            console.error("fetch stops problem");
            console.error(e);
          });
      })
      .catch(e => {
        console.error("fetch routes problem");
        console.error(e);
      });
  }
  render(_, { routes, maxRoute, minRoute, multiRouteStops, stopRouteFinder }) {
    if (stopRouteFinder) {
      console.log(stopRouteFinder("Davis", "Kendall/MIT"));
      console.log(stopRouteFinder("Ashmont", "Arlington"));
      console.log(stopRouteFinder("Mattapan", "Wonderland"));
    }
    return html`
      <div class="main">
        <section>
          <h1>Problem 1)</h1>
          <ol>
            ${routes
              ? routes.map(
                  r => html`
                    <li>${r.attributes.long_name}</li>
                  `,
                )
              : null}
          </ol>
        </section>
        <section>
          <h1>Problem 2)</h1>
          <h2>a) Most Stops</h2>
          <div>${maxRoute}</div>
          <h2>b) Fewest Stops</h2>
          <div>${minRoute}</div>
          <h2>c) Multiple Routes</h2>
          ${multiRouteStops
            ? multiRouteStops.map(
                ([s, rs]) => html`
                  <h3>${s} Stop is on these Routes</h3>
                  <p>${rs.join(", ")}</p>
                `,
              )
            : null}
        </section>
        <section>
          <h1>Problem 3)</h1>
          <div>
            console only output so far
          </div>
        </section>
      </div>
    `;
  }
}

render(
  html`
    <${App} />
  `,
  document.getElementById("app"),
);

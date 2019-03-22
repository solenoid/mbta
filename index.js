import { render, Component, h } from "./web_modules/preact.js";
import htm from "./web_modules/htm.js";
// - https://www.pikapkg.com/blog/pika-web-a-future-without-webpack#pika-web-web-apps-without-the-bundler
// - https://www.npmjs.com/package/htm
const html = htm.bind(h);
class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      routes: [],
      routesWithStops: [],
      multiRouteStops: [],
      maxStops: NaN,
      minStops: NaN
    };
  }
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
              .then(d => d.data)
          );
        Promise.all(stopPromises)
          .then(d => {
            const routesWithStops = routes.map((r, i) => {
              r.stops = d[i];
              r.stopCount = d[i].length;
              return r;
            });
            const stopCounts = routesWithStops.map(r => r.stopCount);
            const maxStops = Math.max(...stopCounts);
            const minStops = Math.min(...stopCounts);
            this.setState({ routesWithStops, maxStops, minStops });
            const stopIndexed = routesWithStops.reduce((memo, r) => {
              r.stops.forEach(s => {
                // assume names are unique if not use ids instead
                const stopKey = s.attributes.name;
                memo[stopKey] = memo[stopKey] || [];
                memo[stopKey].push(r.attributes.long_name);
              });
              return memo;
            }, {});
            const multiRouteStops = Object.entries(stopIndexed).filter(
              ([e, v]) => v.length > 1
            );
            this.setState({ multiRouteStops });
            const intersections = multiRouteStops.reduce(
              (memo, [_, routes]) => {
                const stops = routes
                  .map((r, i, list) => {
                    return list.slice(i + 1).map(d =>
                      // quotes are for graphviz output maybe get rid of them
                      r < d ? `"${r}" -- "${d}"` : `"${d}" -- "${r}"`
                    );
                  })
                  .flat();
                stops.forEach(i => memo.add(i));
                return memo;
              },
              new Set()
            );
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
              const beginEdges = edgeList.filter(
                edge => edge.indexOf(begin) > -1
              );
              const beginEndConnected = beginEdges.some(
                edge => edge.indexOf(end) > -1
              );
              if (beginEndConnected) {
                console.log([begin, ...path, end]);
                return [begin, ...path, end];
              }
              const nextEdges = beginEdges
                .map(e =>
                  e
                    .replace(`"${begin}"`, "")
                    .replace(" -- ", "")
                    .replace(/"/g, "")
                )
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
              routeFinder(beginRoutes[0], endRoutes[0], []);
            };
            this.setState({ intersections, stopRouteFinder });
            return;
            // useful for checking out what the route intersection graph looks like
            console.log(
              `graph {
  ${Array.from(intersections).join("\n  ")}
}`
            );
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
  render(
    _,
    {
      routes,
      routesWithStops,
      maxStops,
      minStops,
      multiRouteStops,
      stopRouteFinder
    }
  ) {
    if (stopRouteFinder) {
      console.log(stopRouteFinder("Mattapan", "Wonderland"));
    }
    return html`
      <div class="main">
        <section>
          <h1>Problem 1)</h1>
          <ol>
            ${routes.map(
              r => html`
                <li>${r.attributes.long_name}</li>
              `
            )}
          </ol>
        </section>
        <section>
          <h1>Problem 2)</h1>
          <h2>a) Most Stops</h2>
          ${routesWithStops
            .filter(r => r.stopCount === maxStops)
            .map(
              r =>
                html`
                  <div>${r.attributes.long_name}</div>
                `
            )}
          <h2>b) Fewest Stops</h2>
          ${routesWithStops
            .filter(r => r.stopCount === minStops)
            .map(
              r =>
                html`
                  <div>${r.attributes.long_name}</div>
                `
            )}
          <h2>c) Multiple Routes</h2>
          ${multiRouteStops.map(
            ([s, rs]) =>
              html`
                <h3>${s} Stop is on these Routes</h3>
                <p>${rs.join(", ")}</p>
              `
          )}
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
  document.getElementById("app")
);

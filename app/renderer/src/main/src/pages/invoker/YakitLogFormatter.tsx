import React from "react";
import {Button, Card, Col, Divider, Row, Space, Table, Tag, Typography} from "antd";
import ReactJson from "react-json-view";
import {formatTimestamp} from "../../utils/timeUtil";
import {showModal} from "../../utils/showModal";
import {GraphData} from "../graph/base";
import {BarGraph} from "../graph/BarGraph";
import {PieGraph} from "../graph/PieGraph";

export interface YakitLogFormatterProp {
    level: string
    data: string | any
    timestamp: number
}

export const YakitLogFormatter: React.FC<YakitLogFormatterProp> = (props) => {
    switch (props.level) {
        case "json":
            return <Space direction={"vertical"} style={{width: "100%"}}>
                {props.timestamp > 0 && <Tag color={"geekblue"}>{formatTimestamp(props.timestamp)}</Tag>}
                <Card title={"JSON 结果输出"} size={"small"}>
                    <ReactJson src={JSON.parse(props.data)}/>
                </Card>
            </Space>
        case "success":
            return <Space direction={"vertical"} style={{width: "100%"}}>
                {props.timestamp > 0 && <Tag color={"geekblue"}>{formatTimestamp(props.timestamp)}</Tag>}
                <Card size={"small"} title={<Tag color={"green"}>模块执行结果</Tag>}>
                    {props.data}
                </Card>
            </Space>
        case "json-table":
            let obj: { head: string[], data: string[][] } = JSON.parse(props.data)
            return <Space direction={"vertical"} style={{width: "100%"}}>
                {props.timestamp > 0 && <Tag color={"geekblue"}>{formatTimestamp(props.timestamp)}</Tag>}
                <Card
                    size={"small"} title={<Tag color={"green"}>直接结果(表格)</Tag>}
                    extra={[
                        <Button onClick={e => showModal({
                            title: "JSON 数据",
                            content: <>
                                <ReactJson src={obj}/>
                            </>
                        })}>JSON</Button>
                    ]}
                >
                    {(obj.head || []).length > 0 && <Row gutter={4}>
                        {(obj.head || []).map(i => <Col span={24.0 / (obj.head.length)}>
                            <div style={{border: "2px"}}>
                                {i}
                            </div>
                        </Col>)}
                        <Divider style={{marginTop: 4, marginBottom: 4}}/>
                    </Row>}
                    {(obj.data || []).length > 0 && <>
                        {obj.data.map(i => <Row>
                            {(i || []).map(element => {
                                return <Col span={24.0 / (i.length)}>
                                    {element}
                                </Col>
                            })}
                        </Row>)}
                    </>}
                </Card>
            </Space>
        case "json-graph":
            let graphData: GraphData = JSON.parse(props.data);
            return <Space direction={"vertical"}>
                {props.timestamp > 0 && <Tag color={"geekblue"}>{formatTimestamp(props.timestamp)}</Tag>}
                <Card
                    size={"small"} title={<Tag color={"green"}>直接结果(图)</Tag>}
                    extra={[
                        <Button onClick={e => showModal({
                            title: "JSON 数据",
                            content: <>
                                <ReactJson src={graphData}/>
                            </>
                        })}>JSON</Button>
                    ]}
                >
                    {(() => {
                        switch (graphData.type) {
                            case "bar":
                                return <div>
                                    <BarGraph {...graphData}/>
                                </div>
                            case "pie":
                                return <div>
                                    <PieGraph {...graphData}/>
                                </div>
                        }
                        return <div>{props.data}</div>
                    })()}
                </Card>
            </Space>
    }
    return <Space>
        {props.timestamp > 0 && <Tag color={"geekblue"}>{formatTimestamp(props.timestamp)}</Tag>}
        <Typography.Text copyable={true}>
            {props.data}
        </Typography.Text>
    </Space>
};